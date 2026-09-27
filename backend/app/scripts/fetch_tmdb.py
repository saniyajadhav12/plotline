"""
Step 2 of the ingestion pipeline: fetch TMDb data (details + credits +
watch providers, in one call via append_to_response) for each of the
1,500 selected movies, and cache raw JSON responses to disk.

Safe to re-run: movies already cached are skipped.
"""
import json
import time
from pathlib import Path

import requests

from app.core.config import settings
from app.scripts.load_movielens import load_and_filter

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "cache" / "tmdb"
BASE_URL = "https://api.themoviedb.org/3/movie/{tmdb_id}"
REQUEST_DELAY_SECONDS = 0.05  # ~20 req/sec, well under TMDb's ~50 req/sec limit
MAX_RETRIES = 3


def fetch_movie(tmdb_id: int) -> dict | None:
    params = {
        "api_key": settings.tmdb_api_key,
        "append_to_response": "credits,watch/providers",
    }
    url = BASE_URL.format(tmdb_id=tmdb_id)

    for attempt in range(1, MAX_RETRIES + 1):
        response = requests.get(url, params=params, timeout=10)

        if response.status_code == 200:
            return response.json()

        if response.status_code == 404:
            print(f"  [tmdb_id={tmdb_id}] not found (404) — skipping")
            return None

        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 2))
            print(f"  [tmdb_id={tmdb_id}] rate limited, waiting {retry_after}s (attempt {attempt})")
            time.sleep(retry_after)
            continue

        print(f"  [tmdb_id={tmdb_id}] unexpected status {response.status_code} (attempt {attempt})")
        time.sleep(1)

    print(f"  [tmdb_id={tmdb_id}] FAILED after {MAX_RETRIES} attempts")
    return None


def run():
    _, _, links = load_and_filter()
    tmdb_ids = links["tmdbId"].tolist()

    already_cached = 0
    fetched = 0
    failed = 0

    for i, tmdb_id in enumerate(tmdb_ids, start=1):
        cache_path = CACHE_DIR / f"{tmdb_id}.json"

        if cache_path.exists():
            already_cached += 1
            continue

        data = fetch_movie(tmdb_id)
        if data is None:
            failed += 1
            continue

        cache_path.write_text(json.dumps(data))
        fetched += 1

        if i % 100 == 0:
            print(f"Progress: {i}/{len(tmdb_ids)} processed "
                  f"(fetched={fetched}, cached={already_cached}, failed={failed})")

        time.sleep(REQUEST_DELAY_SECONDS)

    print(f"\nDone. Fetched: {fetched}, already cached: {already_cached}, failed: {failed}")


if __name__ == "__main__":
    run()
