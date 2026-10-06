"""
Hybrid recommendation scoring.

Combines collaborative filtering, content-based filtering, and a
watchlist soft signal into one blended score per candidate movie.
"""
import uuid

from sqlalchemy.orm import Session

from app.models import Watchlist, Movie

CF_WEIGHT = 0.4
CONTENT_WEIGHT = 0.35
WATCHLIST_WEIGHT = 0.1
POPULARITY_WEIGHT = 0.15


def _normalize(scores: dict[str, float]) -> dict[str, float]:
    """Min-max normalize scores to 0-1 range so different signals are comparable."""
    if not scores:
        return {}
    values = list(scores.values())
    min_val, max_val = min(values), max(values)
    if max_val == min_val:
        return {k: 1.0 for k in scores}
    return {k: (v - min_val) / (max_val - min_val) for k, v in scores.items()}


def get_popularity_boost(db: Session, candidate_movie_ids: set[str]) -> dict[str, float]:
    """
    Returns a 0-1 popularity/recency signal per candidate movie, blending
    normalized real-world TMDb popularity with normalized release year
    (more recent = higher), so current/trending movies get a genuine
    boost in the final ranking rather than relying solely on content
    or collaborative similarity, which naturally skew toward whatever
    dominates the historical ratings data.
    """
    if not candidate_movie_ids:
        return {}

    uuid_ids = [uuid.UUID(m) for m in candidate_movie_ids]
    rows = (
        db.query(Movie.id, Movie.popularity_score, Movie.year)
        .filter(Movie.id.in_(uuid_ids))
        .all()
    )

    popularity_values = [r.popularity_score for r in rows if r.popularity_score is not None]
    year_values = [r.year for r in rows if r.year is not None]

    pop_min, pop_max = (min(popularity_values), max(popularity_values)) if popularity_values else (0, 0)
    year_min, year_max = (min(year_values), max(year_values)) if year_values else (0, 0)

    boosts = {}
    for row in rows:
        movie_id_str = str(row.id)

        if row.popularity_score is not None and pop_max > pop_min:
            pop_norm = (row.popularity_score - pop_min) / (pop_max - pop_min)
        else:
            pop_norm = 0.0

        if row.year is not None and year_max > year_min:
            year_norm = (row.year - year_min) / (year_max - year_min)
        else:
            year_norm = 0.0

        boosts[movie_id_str] = (pop_norm + year_norm) / 2

    return boosts


def get_watchlist_boost(user_id: uuid.UUID, db: Session, candidate_movie_ids: set[str]) -> dict[str, float]:
    """
    Returns a small boost for movies that share genres with the user's
    watchlisted movies. Simpler proxy: boost movies that ARE on the
    watchlist itself (since watchlisted movies are natural candidates
    to resurface as "you might want to watch this").
    """
    watchlist_movie_ids = {
        str(w.movie_id)
        for w in db.query(Watchlist).filter(Watchlist.user_id == user_id).all()
    }
    return {
        movie_id: 1.0 for movie_id in candidate_movie_ids
        if movie_id in watchlist_movie_ids
    }


def compute_hybrid_scores(
    user_id: uuid.UUID,
    db: Session,
    cf_scores: dict[str, float],
    content_scores: dict[str, float],
    top_n: int = 10,
) -> list[tuple[str, float, dict]]:
    """
    Returns a list of (movie_id, final_score, signal_breakdown) tuples,
    sorted descending, for the top_n recommended movies.

    signal_breakdown includes the individual normalized component scores
    so we know which signal(s) drove each recommendation (used later for
    generating the "why this was recommended" explanation).
    """
    all_candidate_ids = set(cf_scores.keys()) | set(content_scores.keys())

    norm_cf = _normalize(cf_scores)
    norm_content = _normalize(content_scores)
    watchlist_boost = get_watchlist_boost(user_id, db, all_candidate_ids)
    popularity_boost = get_popularity_boost(db, all_candidate_ids)

    final_scores = []
    for movie_id in all_candidate_ids:
        cf_component = norm_cf.get(movie_id, 0.0)
        content_component = norm_content.get(movie_id, 0.0)
        watchlist_component = watchlist_boost.get(movie_id, 0.0)
        popularity_component = popularity_boost.get(movie_id, 0.0)

        final_score = (
            CF_WEIGHT * cf_component
            + CONTENT_WEIGHT * content_component
            + WATCHLIST_WEIGHT * watchlist_component
            + POPULARITY_WEIGHT * popularity_component
        )

        raw_cf = cf_scores.get(movie_id)
        raw_content = content_scores.get(movie_id)

        breakdown = {
            "cf_score": round(float(cf_component), 3),
            "content_score": round(float(content_component), 3),
            "watchlist_boost": round(float(watchlist_component), 3),
            "popularity_boost": round(float(popularity_component), 3),
            "raw_cf_score": round(float(raw_cf), 3) if raw_cf is not None else None,
            "raw_content_score": round(float(raw_content), 3) if raw_content is not None else None,
        }
        final_scores.append((movie_id, float(final_score), breakdown))

    final_scores.sort(key=lambda x: x[1], reverse=True)
    return final_scores[:top_n]


def determine_primary_method(breakdown: dict) -> str:
    """Determines whether a recommendation was primarily driven by CF, content, or both (hybrid)."""
    cf = breakdown["cf_score"]
    content = breakdown["content_score"]

    if cf > 0 and content > 0 and abs(cf - content) < 0.15:
        return "hybrid"
    elif cf >= content:
        return "collaborative"
    else:
        return "content"
