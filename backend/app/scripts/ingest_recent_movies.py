"""
Ingests the recent/popular TMDb-only movies (fetched via
fetch_recent_movies.py) into Postgres. These have no MovieLens
rating history — movielens_id is left NULL — so they won't feed
collaborative filtering until real users rate them, but they work
fine for browsing, search, content-based recommendations, and
manual rating/watchlist.

Safe to re-run: upserts by tmdb_id.
"""
import json
import uuid
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import SessionLocal
from app.models import Movie, CastCrew, WatchProvider

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "cache" / "tmdb"
IDS_FILE = Path(__file__).resolve().parents[1] / "data" / "recent_movie_ids.json"

PROVIDER_TYPE_MAP = {
    "flatrate": "subscription",
    "rent": "rent",
    "buy": "buy",
}


def load_cached_tmdb(tmdb_id: int) -> dict | None:
    cache_path = CACHE_DIR / f"{tmdb_id}.json"
    if not cache_path.exists():
        return None
    return json.loads(cache_path.read_text())


def _truncate(value, max_len):
    if value is None:
        return None
    value = str(value)
    return value[:max_len] if len(value) > max_len else value


def upsert_movie(db, tmdb_id: int, tmdb_data: dict) -> uuid.UUID:
    year = None
    if tmdb_data.get("release_date"):
        try:
            year = int(tmdb_data["release_date"][:4])
        except (ValueError, TypeError):
            pass

    genres = [g["name"] for g in tmdb_data.get("genres", [])]
    poster_path = tmdb_data.get("poster_path")
    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
    title = tmdb_data.get("title") or f"TMDb #{tmdb_id}"
    popularity_score = tmdb_data.get("popularity")
    tmdb_vote_average = tmdb_data.get("vote_average")
    tmdb_vote_count = tmdb_data.get("vote_count")

    stmt = pg_insert(Movie).values(
        id=uuid.uuid4(),
        tmdb_id=tmdb_id,
        movielens_id=None,
        title=title,
        year=year,
        genres=genres,
        description=tmdb_data.get("overview"),
        poster_url=poster_url,
        popularity_score=popularity_score,
        tmdb_vote_average=tmdb_vote_average,
        tmdb_vote_count=tmdb_vote_count,
    ).on_conflict_do_update(
        index_elements=["tmdb_id"],
        set_={
            "title": title,
            "year": year,
            "genres": genres,
            "description": tmdb_data.get("overview"),
            "poster_url": poster_url,
            "popularity_score": popularity_score,
            "tmdb_vote_average": tmdb_vote_average,
            "tmdb_vote_count": tmdb_vote_count,
        },
    ).returning(Movie.id)

    result = db.execute(stmt)
    return result.scalar_one()


def upsert_cast_crew(db, movie_id: uuid.UUID, tmdb_data: dict):
    credits = tmdb_data.get("credits", {})

    db.query(CastCrew).filter(CastCrew.movie_id == movie_id).delete()

    directors = [c for c in credits.get("crew", []) if c.get("job") == "Director"]
    for d in directors[:2]:
        db.add(CastCrew(
            movie_id=movie_id,
            person_name=_truncate(d["name"], 255),
            role="director",
            character_name=None,
        ))

    top_cast = credits.get("cast", [])[:10]
    for c in top_cast:
        db.add(CastCrew(
            movie_id=movie_id,
            person_name=_truncate(c["name"], 255),
            role="cast",
            character_name=_truncate(c.get("character"), 255),
        ))


def upsert_watch_providers(db, movie_id: uuid.UUID, tmdb_data: dict):
    providers_block = tmdb_data.get("watch/providers", {}).get("results", {})

    db.query(WatchProvider).filter(WatchProvider.movie_id == movie_id).delete()

    for region, region_data in providers_block.items():
        for tmdb_type, provider_type in PROVIDER_TYPE_MAP.items():
            for provider in region_data.get(tmdb_type, []):
                db.add(WatchProvider(
                    movie_id=movie_id,
                    region=region,
                    provider_name=provider["provider_name"],
                    provider_type=provider_type,
                ))


def run():
    if not IDS_FILE.exists():
        print(f"No {IDS_FILE} found — run fetch_recent_movies.py first.")
        return

    tmdb_ids = json.loads(IDS_FILE.read_text())
    print(f"Ingesting {len(tmdb_ids)} recent/popular movies...")

    db = SessionLocal()
    inserted = 0
    skipped = 0

    try:
        for i, tmdb_id in enumerate(tmdb_ids, start=1):
            tmdb_data = load_cached_tmdb(tmdb_id)
            if tmdb_data is None:
                skipped += 1
                continue

            movie_id = upsert_movie(db, tmdb_id, tmdb_data)
            upsert_cast_crew(db, movie_id, tmdb_data)
            upsert_watch_providers(db, movie_id, tmdb_data)
            inserted += 1

            if i % 100 == 0:
                db.commit()
                print(f"  {i}/{len(tmdb_ids)} processed")

        db.commit()
        print(f"\nDone. Inserted/updated: {inserted}, skipped (no cache): {skipped}")

    finally:
        db.close()


if __name__ == "__main__":
    run()
