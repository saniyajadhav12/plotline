"""
Step 3 of the ingestion pipeline: write MovieLens + cached TMDb data
into Postgres. Upserts movies/cast_crew/watch_providers by tmdb_id/
movielens_id so this is safe to re-run.

Also creates placeholder users (one per MovieLens userId) so that
ratings have a valid user_id to reference. These are seed/demo users,
not real accounts — no usable password is set.

Ratings are bulk-inserted via psycopg2.extras.execute_values in
batches, since at this dataset's scale (millions of rows) row-by-row
ORM inserts are far too slow.
"""
import json
import uuid
from pathlib import Path

import psycopg2.extras
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.database import SessionLocal
from app.models import Movie, CastCrew, WatchProvider, User
from app.scripts.load_movielens import load_and_filter

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "cache" / "tmdb"

PROVIDER_TYPE_MAP = {
    "flatrate": "subscription",
    "rent": "rent",
    "buy": "buy",
}

RATINGS_BATCH_SIZE = 20000


def load_cached_tmdb(tmdb_id: int) -> dict | None:
    cache_path = CACHE_DIR / f"{tmdb_id}.json"
    if not cache_path.exists():
        return None
    return json.loads(cache_path.read_text())


def upsert_movie(db, movielens_id: int, tmdb_id: int, ml_title: str, ml_genres: str, tmdb_data: dict) -> uuid.UUID | None:
    year = None
    if tmdb_data.get("release_date"):
        try:
            year = int(tmdb_data["release_date"][:4])
        except (ValueError, TypeError):
            pass

    genres = [g["name"] for g in tmdb_data.get("genres", [])] or ml_genres.replace("|", ",").split(",")
    poster_path = tmdb_data.get("poster_path")
    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None

    stmt = pg_insert(Movie).values(
        id=uuid.uuid4(),
        tmdb_id=tmdb_id,
        movielens_id=movielens_id,
        title=tmdb_data.get("title") or ml_title,
        year=year,
        genres=genres,
        description=tmdb_data.get("overview"),
        poster_url=poster_url,
    ).on_conflict_do_update(
        index_elements=["tmdb_id"],
        set_={
            "title": tmdb_data.get("title") or ml_title,
            "year": year,
            "genres": genres,
            "description": tmdb_data.get("overview"),
            "poster_url": poster_url,
        },
    ).returning(Movie.id)

    result = db.execute(stmt)
    return result.scalar_one()


def _truncate(value, max_len):
    if value is None:
        return None
    value = str(value)
    return value[:max_len] if len(value) > max_len else value


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


def upsert_placeholder_users(db, movielens_user_ids: list[int]) -> dict[int, uuid.UUID]:
    user_id_map = {}
    for ml_user_id in movielens_user_ids:
        email = f"movielens_user_{ml_user_id}@placeholder.plotline.local"
        stmt = pg_insert(User).values(
            id=uuid.uuid4(),
            email=email,
            hashed_password="!",
            region_preference="US",
        ).on_conflict_do_update(
            index_elements=["email"],
            set_={"email": email},
        ).returning(User.id)
        result = db.execute(stmt)
        user_id_map[ml_user_id] = result.scalar_one()
    return user_id_map


def bulk_insert_ratings(db, ratings_df, movielens_to_movie_id: dict[int, uuid.UUID], movielens_to_user_id: dict[int, uuid.UUID]):
    raw_conn = db.connection().connection
    cur = raw_conn.cursor()

    cur.execute("DELETE FROM ratings")
    raw_conn.commit()

    insert_sql = (
        "INSERT INTO ratings (id, user_id, movie_id, rating_value) "
        "VALUES %s ON CONFLICT (user_id, movie_id) DO NOTHING"
    )

    batch = []
    total_inserted = 0
    total_skipped = 0

    for row in ratings_df.itertuples():
        movie_id = movielens_to_movie_id.get(row.movieId)
        user_id = movielens_to_user_id.get(row.userId)
        if not movie_id or not user_id:
            total_skipped += 1
            continue

        rating_value = max(1, min(5, round(row.rating)))
        batch.append((str(uuid.uuid4()), str(user_id), str(movie_id), rating_value))

        if len(batch) >= RATINGS_BATCH_SIZE:
            psycopg2.extras.execute_values(cur, insert_sql, batch)
            raw_conn.commit()
            total_inserted += len(batch)
            print(f"  {total_inserted} ratings inserted...")
            batch = []

    if batch:
        psycopg2.extras.execute_values(cur, insert_sql, batch)
        raw_conn.commit()
        total_inserted += len(batch)

    cur.close()
    print(f"Ratings done: {total_inserted} inserted, {total_skipped} skipped (missing movie/user mapping)")


def run():
    movies_df, ratings_df, links_df = load_and_filter()
    db = SessionLocal()

    try:
        movielens_to_movie_id = {}
        skipped = 0

        print("Upserting movies + cast/crew + watch providers...")
        for i, row in enumerate(links_df.itertuples(), start=1):
            tmdb_data = load_cached_tmdb(row.tmdbId)
            if tmdb_data is None:
                skipped += 1
                continue

            ml_row = movies_df[movies_df["movieId"] == row.movieId].iloc[0]
            movie_id = upsert_movie(db, row.movieId, row.tmdbId, ml_row["title"], ml_row["genres"], tmdb_data)
            movielens_to_movie_id[row.movieId] = movie_id

            upsert_cast_crew(db, movie_id, tmdb_data)
            upsert_watch_providers(db, movie_id, tmdb_data)

            if i % 200 == 0:
                db.commit()
                print(f"  {i}/{len(links_df)} movies processed")

        db.commit()
        print(f"Movies done. Skipped (no cached TMDb data): {skipped}")

        print("Upserting placeholder users...")
        movielens_to_user_id = upsert_placeholder_users(db, ratings_df["userId"].unique().tolist())
        db.commit()
        print(f"Users done: {len(movielens_to_user_id)}")

        print("Bulk inserting ratings...")
        bulk_insert_ratings(db, ratings_df, movielens_to_movie_id, movielens_to_user_id)

    finally:
        db.close()


if __name__ == "__main__":
    run()
