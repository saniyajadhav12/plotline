"""
In-process cache for the expensive, catalog-wide pieces of the
recommendation pipeline (item similarity, content similarity).

These depend on the whole ratings/movie catalog, not any single user,
so recomputing them per-request or per-trigger would be wasteful.
Instead we cache them in memory and refresh on a cooldown, so a burst
of triggers (e.g. many users onboarding around the same time) only
recomputes once per cooldown window rather than once per user.

This is a simple time-based cache suitable for a single-process dev/
demo deployment. A multi-process production deployment would need a
shared cache (e.g. Redis) instead, since each process would otherwise
hold its own copy.
"""
import threading
import time

from app.core.database import SessionLocal
from app.services.collaborative_filtering import load_ratings_matrix, compute_item_similarity
from app.services.content_based_filtering import build_movie_profiles, compute_content_similarity

REFRESH_COOLDOWN_SECONDS = 15 * 60  # 15 minutes

_lock = threading.Lock()
_cache = {
    "ratings_matrix": None,
    "item_similarity": None,
    "content_similarity": None,
    "last_built_at": 0.0,
}


def get_cached_matrices():
    """
    Returns (ratings_matrix, item_similarity, content_similarity),
    rebuilding them if the cache is empty or past its cooldown.
    Thread-safe: concurrent callers block on the same rebuild rather
    than each kicking off their own.
    """
    now = time.time()
    needs_refresh = (
        _cache["ratings_matrix"] is None
        or (now - _cache["last_built_at"]) > REFRESH_COOLDOWN_SECONDS
    )

    if not needs_refresh:
        return _cache["ratings_matrix"], _cache["item_similarity"], _cache["content_similarity"]

    with _lock:
        # Re-check after acquiring the lock in case another thread just rebuilt it
        now = time.time()
        needs_refresh = (
            _cache["ratings_matrix"] is None
            or (now - _cache["last_built_at"]) > REFRESH_COOLDOWN_SECONDS
        )
        if not needs_refresh:
            return _cache["ratings_matrix"], _cache["item_similarity"], _cache["content_similarity"]

        print("[recommendation_cache] Rebuilding catalog-wide similarity matrices...")
        db = SessionLocal()
        try:
            ratings_matrix = load_ratings_matrix(db)
            item_similarity = compute_item_similarity(ratings_matrix)
            profiles = build_movie_profiles(db)
            content_similarity = compute_content_similarity(profiles)
        finally:
            db.close()

        _cache["ratings_matrix"] = ratings_matrix
        _cache["item_similarity"] = item_similarity
        _cache["content_similarity"] = content_similarity
        _cache["last_built_at"] = now
        print("[recommendation_cache] Rebuild complete.")

        return ratings_matrix, item_similarity, content_similarity


def invalidate_cache():
    """Forces the next get_cached_matrices() call to rebuild immediately."""
    with _lock:
        _cache["last_built_at"] = 0.0
