"""
Backfills movies.original_language from the cached TMDb responses in
app/data/cache/tmdb/ (written by fetch_tmdb.py and fetch_recent_movies.py).

No API calls: every cached TMDb details response already includes
original_language (ISO 639-1, e.g. 'en', 'hi', 'ko'). Safe to re-run.

Usage (from backend/, with venv active):
    python -m app.scripts.backfill_original_language
"""
import json
import time
from pathlib import Path

from sqlalchemy import text

from app.core.database import SessionLocal

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "cache" / "tmdb"


def load_languages_from_cache() -> tuple[list[int], list[str], int]:
    """Returns (tmdb_ids, languages, unreadable_file_count) from the cache folder."""
    tmdb_ids: list[int] = []
    languages: list[str] = []
    unreadable = 0

    for path in CACHE_DIR.glob("*.json"):
        try:
            tmdb_id = int(path.stem)
            data = json.loads(path.read_text())
        except (ValueError, json.JSONDecodeError):
            unreadable += 1
            continue

        language = (data.get("original_language") or "").strip().lower()
        if language:
            tmdb_ids.append(tmdb_id)
            languages.append(language[:10])

    return tmdb_ids, languages, unreadable


def main():
    start = time.time()
    tmdb_ids, languages, unreadable = load_languages_from_cache()
    print(f"Read {len(tmdb_ids):,} languages from {CACHE_DIR} ({unreadable} unreadable files)")

    db = SessionLocal()
    try:
        # One round trip: pair the two arrays up and update every matching movie at once.
        result = db.execute(
            text("""
                UPDATE movies m
                SET original_language = v.language
                FROM unnest(CAST(:tmdb_ids AS integer[]), CAST(:languages AS text[]))
                     AS v(tmdb_id, language)
                WHERE m.tmdb_id = v.tmdb_id
            """),
            {"tmdb_ids": tmdb_ids, "languages": languages},
        )
        db.commit()

        missing = db.execute(
            text("SELECT count(*) FROM movies WHERE original_language IS NULL")
        ).scalar()
        top = db.execute(text("""
            SELECT original_language, count(*) AS movies
            FROM movies
            WHERE original_language IS NOT NULL
            GROUP BY 1 ORDER BY 2 DESC LIMIT 10
        """)).all()
    finally:
        db.close()

    print(f"Updated {result.rowcount:,} movies in {time.time() - start:.1f}s")
    print(f"Movies still without a language: {missing:,}")
    print("Top languages:")
    for language, count in top:
        print(f"  {language}: {count:,}")


if __name__ == "__main__":
    main()
