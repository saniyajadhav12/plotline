"""
Generates and persists hybrid recommendations for a single user,
using precomputed movie_neighbors rows.

Split into two phases so users never wait on Gemini:
  1. save_recommendations_for_user(): score and save all recommendations
     immediately with instant templated explanations. Fast enough to run
     inside the request, so the home page has results the moment it loads.
  2. upgrade_explanations(): best-effort Gemini rewrite of each explanation,
     one commit per row. Runs in a background task after the response.
     Stops early if Gemini's quota runs out (circuit breaker) or if a newer
     run has already replaced these recommendations.

generate_recommendations_for_user() runs both phases back to back, for
callers that want one blocking call (e.g. the demo batch script).
"""
import uuid
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Movie, RecommendationLog
from app.services.neighbor_recommender import recommend_cf_from_neighbors, recommend_content_from_neighbors
from app.services.hybrid_recommender import compute_hybrid_scores, determine_primary_method
from app.services.explanation_generator import (
    fallback_explanation,
    gemini_available,
    try_gemini_explanation,
)

RECS_PER_USER = 10


@dataclass
class PendingExplanation:
    """What phase 2 needs to upgrade one saved recommendation. Plain ids and a
    dict (no ORM objects) so it can safely cross into a background task that
    uses its own DB session."""
    recommendation_id: uuid.UUID
    movie_id: uuid.UUID
    breakdown: dict


def save_recommendations_for_user(
    user_id: uuid.UUID, db: Session, with_explanations: bool = True
) -> list[PendingExplanation]:
    """
    Phase 1. Scores, then replaces the user's recommendation_logs rows in a
    single commit, each with an instant templated explanation. Returns one
    PendingExplanation per saved row ([] if there was no signal at all, i.e.
    a true cold-start user with no ratings and no onboarding data).
    """
    cf_scores = recommend_cf_from_neighbors(user_id, db, top_n=50)
    content_scores = recommend_content_from_neighbors(user_id, db, top_n=50)

    if not cf_scores and not content_scores:
        return []

    hybrid_results = compute_hybrid_scores(user_id, db, cf_scores, content_scores, top_n=RECS_PER_USER)
    if not hybrid_results:
        return []

    rows: list[tuple[RecommendationLog, dict]] = []
    for movie_id, score, breakdown in hybrid_results:
        movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not movie:
            continue

        row = RecommendationLog(
            id=uuid.uuid4(),
            user_id=user_id,
            movie_id=movie.id,
            method=determine_primary_method(breakdown),
            explanation_text=(
                fallback_explanation(user_id, movie, breakdown, db) if with_explanations else None
            ),
            is_cached=True,
        )
        rows.append((row, breakdown))

    if not rows:
        return []

    # Old recommendations stay visible until this single commit replaces them,
    # so there is never an empty "no recommendations yet" gap.
    db.query(RecommendationLog).filter(RecommendationLog.user_id == user_id).delete()
    db.add_all([row for row, _ in rows])
    db.commit()

    return [
        PendingExplanation(recommendation_id=row.id, movie_id=row.movie_id, breakdown=breakdown)
        for row, breakdown in rows
    ]


def upgrade_explanations(user_id: uuid.UUID, pending: list[PendingExplanation], db: Session) -> int:
    """
    Phase 2. Replaces templated explanations with Gemini-written ones, one
    commit per row so each upgrade shows up as soon as it's ready. Returns how
    many were upgraded.
    """
    upgraded = 0
    for item in pending:
        if not gemini_available():
            break  # quota exhausted: keep the templated text for the rest

        row = db.get(RecommendationLog, item.recommendation_id)
        if row is None:
            break  # a newer run already replaced these recommendations

        movie = db.get(Movie, item.movie_id)
        if movie is None:
            continue

        text = try_gemini_explanation(user_id, movie, item.breakdown, db)
        if not text:
            continue

        try:
            row.explanation_text = text
            db.commit()
            upgraded += 1
        except Exception as e:
            db.rollback()
            print(f"  [Gemini] stopped upgrading explanations: {e}")
            break

    print(f"  [Gemini] upgraded {upgraded}/{len(pending)} explanations for user {user_id}")
    return upgraded


def upgrade_explanations_background(user_id: uuid.UUID, pending: list[PendingExplanation]) -> None:
    """Background-task entry point: phase 2 with its own DB session, since the
    request-scoped session is closed once the response is sent."""
    db = SessionLocal()
    try:
        upgrade_explanations(user_id, pending, db)
    except Exception as e:
        print(f"[background] Explanation upgrade failed for user {user_id}: {e}")
    finally:
        db.close()


def generate_recommendations_for_user(user_id: uuid.UUID, db: Session, with_explanations: bool = True) -> int:
    """Both phases in one blocking call. Returns the number of recommendations saved."""
    pending = save_recommendations_for_user(user_id, db, with_explanations=with_explanations)
    if with_explanations and pending:
        upgrade_explanations(user_id, pending, db)
    return len(pending)
