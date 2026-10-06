"""
Option B of the catalog expansion: fetch ~500 current/popular movies
directly from TMDb (not tied to MovieLens), to cover recent releases
our MovieLens-based catalog can't include. These movies have no
rating history, so they won't feed collaborative filtering until
real users rate them — but they work fine for browsing, search,
content-based recommendations, and manual rating/watchlist.

Uses TMDb's /discover/movie endpoint, sorted by popularity, filtered
to the last ~3 years, paginated (20 results/page).
"""
import json
import time
from pathlib import Path

import requests

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Movie

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "cache" / "tmdb"
DISCOVER_URL = "https://api.themoviedb.org/3/discover/movie"
DETAIL_URL = "https://api.themoviedb.org/3/movie/{tmdb_id}"
TARGET_COUNT = 500
REQUEST_DELAY_SECONDS = 0.05
MAX_RETRIES = 3

# Recent releases only — adjust year range here if needed
MIN_RELEASE_YEAR = 2022


def get_existing_tmdb_ids() -> set[int]:
    db = SessionLocal()
    try:
        rows = db.query(Movie.tmdb_id).filter(Movie.tmdb_id.isnot(None)).all()
        return {r[0] for r in rows}
    finally:
        db.close()


def discover_recent_popular_ids(existing_ids: set[int], target_count: int) -> list[int]:
    collected = []
    page = 1
    max_pages = 50  # safety cap

    while len(collected) < target_count and page <= max_pages:
        params = {
            "api_key": settings.tmdb_api_key,
            "sort_by": "popularity.desc",
            "primary_release_date.gte": f"{MIN_RELEASE_YEAR}-01-01",
            "vote_count.gte": 50,  # filter out obscure/low-signal entries
            "page": page,
        }
        response = requests.get(DISCOVER_URL, params=params, timeout=10)
        if response.status_code != 200:
            print(f"  [discover] page {page} failed with status {response.status_code}")
            break

        data = response.json()
        results = data.get("results", [])
        if not results:
            break

        for movie in results:
            tmdb_id = movie["id"]
            if tmdb_id not in existing_ids and tmdb_id not in collected:
                collected.append(tmdb_id)

        page += 1
        time.sleep(REQUEST_DELAY_SECONDS)

    return collected[:target_count]


def fetch_movie_detail(tmdb_id: int) -> dict | None:
    params = {
        "api_key": settings.tmdb_api_key,
        "append_to_response": "credits,watch/providers",
    }
    url = DETAIL_URL.format(tmdb_id=tmdb_id)

    for attempt in range(1, MAX_RETRIES + 1):
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            return response.json()
        if response.status_code == 404:
            return None
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 2))
            time.sleep(retry_after)
            continue
        time.sleep(1)

    return None


def run():
    print("Checking existing movies in database...")
    existing_ids = get_existing_tmdb_ids()
    print(f"  {len(existing_ids)} movies already in database")

    print(f"Discovering up to {TARGET_COUNT} recent popular movies from TMDb "
          f"(released {MIN_RELEASE_YEAR}+)...")
    new_ids = discover_recent_popular_ids(existing_ids, TARGET_COUNT)
    print(f"  Found {len(new_ids)} new candidate movies")

    fetched = 0
    failed = 0

    for i, tmdb_id in enumerate(new_ids, start=1):
        cache_path = CACHE_DIR / f"{tmdb_id}.json"
        if cache_path.exists():
            continue

        data = fetch_movie_detail(tmdb_id)
        if data is None:
            failed += 1
            continue

        cache_path.write_text(json.dumps(data))
        fetched += 1

        if i % 50 == 0:
            print(f"  {i}/{len(new_ids)} processed (fetched={fetched}, failed={failed})")

        time.sleep(REQUEST_DELAY_SECONDS)

    print(f"\nDone. Fetched: {fetched}, failed: {failed}")
    print(f"Cached TMDb IDs ready for ingestion: {len(new_ids)}")

    # Save the list of new IDs so the ingestion step knows exactly which
    # movies are "recent additions" (no MovieLens data to join against)
    ids_file = Path(__file__).resolve().parents[1] / "data" / "recent_movie_ids.json"
    ids_file.write_text(json.dumps(new_ids))
    print(f"Saved ID list to {ids_file}")


if __name__ == "__main__":
    run()
