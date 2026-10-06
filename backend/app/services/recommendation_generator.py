"""
Generates and persists hybrid recommendations for a single user,
using the shared cached catalog-wide matrices. This is the reusable
core used by both the demo batch script and the automatic triggers
(onboarding save, Nth rating).
"""
import uuid

from sqlalchemy.orm import Session

from app.models import Movie, RecommendationLog
from app.services.collaborative_filtering import recommend_cf
from app.services.content_based_filtering import recommend_content_based
from app.services.hybrid_recommender import compute_hybrid_scores, determine_primary_method
from app.services.explanation_generator import generate_explanation
from app.services.recommendation_cache import get_cached_matrices

RECS_PER_USER = 10


def generate_recommendations_for_user(user_id: uuid.UUID, db: Session, with_explanations: bool = True) -> int:
    """
    Computes and writes recommendation_logs rows for one user.
    Returns the number of recommendations written (0 if no signal
    was available at all — a true cold-start user with no ratings
    and no onboarding data).
    """
    ratings_matrix, item_sim, content_sim = get_cached_matrices()

    cf_scores = recommend_cf(user_id, ratings_matrix, item_sim, top_n=50)
    content_scores = recommend_content_based(user_id, db, content_sim, top_n=50)

    if not cf_scores and not content_scores:
        return 0

    hybrid_results = compute_hybrid_scores(user_id, db, cf_scores, content_scores, top_n=RECS_PER_USER)
    if not hybrid_results:
        return 0

    # Build all new rows BEFORE touching existing recommendation_logs,
    # so a user never sees an empty "no recommendations yet" gap while
    # this (potentially slow, due to Gemini retries) loop runs in the
    # background. The old recommendations stay visible the whole time
    # and are only replaced once the new batch is fully ready.
    new_rows = []
    for movie_id, score, breakdown in hybrid_results:
        movie = db.query(Movie).filter(Movie.id == movie_id).first()
        if not movie:
            continue

        method = determine_primary_method(breakdown)
        explanation = (
            generate_explanation(user_id, movie, breakdown, db)
            if with_explanations
            else None
        )

        new_rows.append(RecommendationLog(
            user_id=user_id,
            movie_id=movie.id,
            method=method,
            explanation_text=explanation,
            is_cached=True,
        ))

    if not new_rows:
        return 0

    db.query(RecommendationLog).filter(RecommendationLog.user_id == user_id).delete()
    db.add_all(new_rows)
    db.commit()
    return len(new_rows)
