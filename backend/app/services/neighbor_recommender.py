"""
Serving-time recommendations from precomputed movie_neighbors rows
(built offline by app/scripts/build_offline_artifacts.py).

Same scoring ideas as collaborative_filtering.recommend_cf and
content_based_filtering.recommend_content_based, but each is a single
SQL query touching only the user's own ratings and their movies'
top-K neighbors. Nothing catalog-wide is held in memory.
"""
import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import Rating, OnboardingPreference
from app.services.content_based_filtering import (
    RATING_LIKE_WEIGHT,
    ONBOARDING_MOVIE_WEIGHT,
    _genre_overlap_scores,
)

# With only top-K neighbors stored, a candidate may be "supported" by just one
# of the user's rated movies. Adding a small constant to the denominator stops a
# single 5-star match from outranking a movie that many of their ratings agree on.
CF_SHRINKAGE = 1.0

_CF_SQL = text("""
    WITH user_ratings AS (
        SELECT movie_id, rating_value
        FROM ratings
        WHERE user_id = CAST(:user_id AS uuid)
    )
    SELECT CAST(n.neighbor_id AS text) AS movie_id,
           SUM(n.similarity * ur.rating_value) / (SUM(ABS(n.similarity)) + :shrinkage) AS score
    FROM user_ratings ur
    JOIN movie_neighbors n
      ON n.movie_id = ur.movie_id AND n.kind = 'cf'
    WHERE n.neighbor_id NOT IN (SELECT movie_id FROM user_ratings)
    GROUP BY n.neighbor_id
    ORDER BY score DESC
    LIMIT :top_n
""")

_CONTENT_SQL = text("""
    WITH liked AS (
        SELECT *
        FROM unnest(CAST(:liked_ids AS uuid[]), CAST(:weights AS float8[]))
             AS t(movie_id, weight)
    )
    SELECT CAST(n.neighbor_id AS text) AS movie_id,
           SUM(n.similarity * l.weight) / :weight_total AS score
    FROM liked l
    JOIN movie_neighbors n
      ON n.movie_id = l.movie_id AND n.kind = 'content'
    WHERE NOT (n.neighbor_id = ANY(CAST(:exclude_ids AS uuid[])))
    GROUP BY n.neighbor_id
    ORDER BY score DESC
    LIMIT :top_n
""")


def recommend_cf_from_neighbors(user_id: uuid.UUID, db: Session, top_n: int = 10) -> dict[str, float]:
    """{movie_id: score} for the top_n unrated movies, as a similarity-weighted
    average of the user's ratings over each candidate's precomputed neighbors."""
    rows = db.execute(
        _CF_SQL,
        {"user_id": str(user_id), "shrinkage": CF_SHRINKAGE, "top_n": top_n},
    ).all()
    return {r.movie_id: float(r.score) for r in rows}


def recommend_content_from_neighbors(user_id: uuid.UUID, db: Session, top_n: int = 10) -> dict[str, float]:
    """{movie_id: score} by weighted content similarity to the user's liked movies
    (4-5 star ratings, blended with onboarding favorites). Falls back to genre
    overlap when there is no liked-movie signal yet."""
    rated_movie_ids = {
        str(m) for (m,) in db.query(Rating.movie_id).filter(Rating.user_id == user_id).all()
    }
    liked = (
        db.query(Rating.movie_id)
        .filter(Rating.user_id == user_id, Rating.rating_value >= 4)
        .all()
    )
    weighted_likes: dict[str, float] = {str(m): RATING_LIKE_WEIGHT for (m,) in liked}

    onboarding = (
        db.query(OnboardingPreference)
        .filter(OnboardingPreference.user_id == user_id)
        .first()
    )
    onboarding_movie_ids = [str(m) for m in (onboarding.selected_movie_ids or [])] if onboarding else []
    onboarding_genres = onboarding.selected_genres if onboarding else []

    for movie_id in onboarding_movie_ids:
        weighted_likes.setdefault(movie_id, ONBOARDING_MOVIE_WEIGHT)

    exclude_ids = rated_movie_ids | set(onboarding_movie_ids)

    if not weighted_likes:
        return _genre_overlap_scores(db, onboarding_genres or [], exclude_ids, top_n)

    liked_ids = list(weighted_likes.keys())
    weights = [weighted_likes[m] for m in liked_ids]

    rows = db.execute(
        _CONTENT_SQL,
        {
            "liked_ids": liked_ids,
            "weights": weights,
            "weight_total": sum(weights),
            "exclude_ids": list(exclude_ids),
            "top_n": top_n,
        },
    ).all()
    scores = {r.movie_id: float(r.score) for r in rows}

    if not scores:
        return _genre_overlap_scores(db, onboarding_genres or [], exclude_ids, top_n)
    return scores
