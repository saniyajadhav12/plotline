"""
Copies the catalog data the live app needs from the local database (the
DATABASE_URL in backend/.env) into a production database, e.g. Neon.

Copied: movies (incl. Plotline ratings, languages, embeddings), cast_crew,
US watch_providers, and movie_neighbors (precomputed CF + content neighbors).
Not copied: users, ratings, watchlists, onboarding, recommendation logs.
Real users create their own on the live site, and recommendations are served
from movie_neighbors, so the MovieLens ratings aren't needed in production.

Safety:
  - Refuses to run if the target is the local database, or already has movies.
  - Everything is one transaction; row counts must match or nothing is saved.

Usage (from backend/, with venv active, after running migrations on the target):
    PRODUCTION_DATABASE_URL="postgresql://..." python -m app.scripts.export_to_production
"""
import os
import sys
import tempfile
import time

import psycopg2

from app.core.config import settings

# (table, optional WHERE filter), in foreign-key order: movies first.
TABLES = [
    ("movies", None),
    ("cast_crew", None),
    ("watch_providers", "region = 'US'"),
    ("movie_neighbors", None),
]


def table_columns(cur, table: str) -> list[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    return [row[0] for row in cur.fetchall()]


def main():
    target_url = os.environ.get("PRODUCTION_DATABASE_URL")
    if not target_url:
        sys.exit("Set PRODUCTION_DATABASE_URL to the production connection string.")
    if target_url == settings.database_url:
        sys.exit("Refusing: the target is the same as the local DATABASE_URL.")

    start = time.time()
    source = psycopg2.connect(settings.database_url)
    target = psycopg2.connect(target_url)
    src, dst = source.cursor(), target.cursor()

    dst.execute("SELECT count(*) FROM movies")
    if dst.fetchone()[0] > 0:
        sys.exit("Refusing: the target already has movies. It must be a freshly migrated, empty database.")

    try:
        for table, where in TABLES:
            t0 = time.time()
            columns = table_columns(dst, table)
            missing = sorted(set(columns) - set(table_columns(src, table)))
            if missing:
                raise RuntimeError(f"{table}: source is missing columns {missing}; run migrations locally first.")

            column_list = ", ".join(f'"{c}"' for c in columns)
            query = f"SELECT {column_list} FROM {table}" + (f" WHERE {where}" if where else "")

            # Stream through a temp file so large tables never sit in memory.
            with tempfile.TemporaryFile() as buffer:
                src.copy_expert(f"COPY ({query}) TO STDOUT WITH (FORMAT csv)", buffer)
                size_mb = buffer.tell() / (1024 * 1024)
                buffer.seek(0)
                dst.copy_expert(f"COPY {table} ({column_list}) FROM STDIN WITH (FORMAT csv)", buffer)

            src.execute(f"SELECT count(*) FROM ({query}) AS q")
            expected = src.fetchone()[0]
            dst.execute(f"SELECT count(*) FROM {table}")
            copied = dst.fetchone()[0]
            if copied != expected:
                raise RuntimeError(f"{table}: copied {copied:,} rows but expected {expected:,}.")
            print(f"  {table}: {copied:,} rows ({size_mb:.1f} MB transferred, {time.time() - t0:.1f}s)")

        target.commit()
    except Exception:
        target.rollback()
        print("Rolled back: nothing was saved to the target.")
        raise

    # Post-load maintenance (outside the transaction).
    target.autocommit = True
    dst.execute("SELECT 1 FROM pg_indexes WHERE indexname = 'movies_embedding_idx'")
    if dst.fetchone():
        # ivfflat learns its structure from existing rows; it was built on an empty table.
        print("  rebuilding movies_embedding_idx on the loaded data...")
        dst.execute("REINDEX INDEX movies_embedding_idx")
    dst.execute("ANALYZE")

    dst.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
    print(f"\nDone in {time.time() - start:.1f}s. Production database size: {dst.fetchone()[0]}")
    for table, _ in TABLES:
        dst.execute("SELECT pg_size_pretty(pg_total_relation_size(%s))", (table,))
        print(f"  {table}: {dst.fetchone()[0]}")

    source.close()
    target.close()


if __name__ == "__main__":
    main()
