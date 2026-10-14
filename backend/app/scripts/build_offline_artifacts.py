"""
Builds the precomputed artifacts the live app serves from:

  1. movie_neighbors (kind='cf'): each movie's top-K most similar movies by
     how users rated them (item-based collaborative filtering).
  2. movie_neighbors (kind='content'): each movie's top-K most similar movies
     by TF-IDF over genres, director, cast and description.
  3. movies.avg_rating / movies.rating_count: the "Plotline rating".

Run locally whenever the catalog or ratings change. Production never loads
the full ratings table or holds a movie x movie matrix in memory.

Usage (from backend/, with venv active):
    python -m app.scripts.build_offline_artifacts
"""
import io
import time

import numpy as np
from sklearn.preprocessing import normalize
from sqlalchemy import text

from app.core.database import SessionLocal
from app.services.collaborative_filtering import load_ratings_matrix
from app.services.content_based_filtering import build_movie_profiles, build_tfidf_matrix

TOP_K = 50          # neighbors kept per movie
CHUNK_SIZE = 1000   # movies processed at once (~40 MB float32 per chunk)
MIN_SIMILARITY = 0.0


def write_top_k_neighbors(db, vectors, movie_ids: list[str], kind: str, t0: float) -> int:
    """
    vectors: sparse matrix, one L2-normalized row per movie (row i = movie_ids[i]),
    so a dot product between rows is their cosine similarity. Computes each
    movie's top-K neighbors chunk by chunk and replaces this kind's rows.
    """
    n_movies = vectors.shape[0]
    vectors_T = vectors.T.tocsr()
    k = min(TOP_K, n_movies - 1)
    buffer = io.StringIO()
    n_rows = 0

    print(f"  computing top-{k} '{kind}' neighbors in chunks of {CHUNK_SIZE}...")
    for start in range(0, n_movies, CHUNK_SIZE):
        end = min(start + CHUNK_SIZE, n_movies)
        sims = (vectors[start:end] @ vectors_T).toarray()  # (chunk, n_movies)

        local = np.arange(end - start)
        sims[local, start + local] = -1.0  # a movie is not its own neighbor

        top_idx = np.argpartition(-sims, k, axis=1)[:, :k]
        top_vals = np.take_along_axis(sims, top_idx, axis=1)

        for i in range(end - start):
            movie_id = movie_ids[start + i]
            for j, s in zip(top_idx[i], top_vals[i]):
                if s > MIN_SIMILARITY:
                    buffer.write(f"{movie_id},{kind},{movie_ids[j]},{s:.6f}\n")
                    n_rows += 1

        print(f"    {end:,}/{n_movies:,} movies ({time.time() - t0:.1f}s)")

    db.execute(text("DELETE FROM movie_neighbors WHERE kind = :kind"), {"kind": kind})
    buffer.seek(0)
    cur = db.connection().connection.cursor()
    cur.copy_expert(
        "COPY movie_neighbors (movie_id, kind, neighbor_id, similarity) FROM STDIN WITH CSV",
        buffer,
    )
    cur.close()
    return n_rows


def build_cf_neighbors(db) -> int:
    t0 = time.time()
    print("Collaborative filtering: loading ratings matrix...")
    rm = load_ratings_matrix(db)
    n_users, n_movies = rm.shape
    print(f"  {n_users:,} users x {n_movies:,} movies ({time.time() - t0:.1f}s)")
    vectors = normalize(rm.matrix.T.tocsr().astype(np.float32), norm="l2", axis=1)
    return write_top_k_neighbors(db, vectors, rm.movie_ids, "cf", t0)


def build_content_neighbors(db) -> int:
    t0 = time.time()
    print("Content-based: building movie profiles + TF-IDF...")
    profiles = build_movie_profiles(db)
    tfidf = build_tfidf_matrix(profiles).astype(np.float32)
    vectors = normalize(tfidf, norm="l2", axis=1)
    print(f"  {vectors.shape[0]:,} movies x {vectors.shape[1]:,} terms ({time.time() - t0:.1f}s)")
    return write_top_k_neighbors(db, vectors, list(profiles.index), "content", t0)


def build_rating_stats(db) -> int:
    print("Plotline ratings: computing avg + count per movie...")
    db.execute(text("UPDATE movies SET avg_rating = NULL, rating_count = 0"))
    result = db.execute(text("""
        UPDATE movies m
        SET avg_rating = s.avg_rating,
            rating_count = s.rating_count
        FROM (
            SELECT movie_id,
                   AVG(rating_value)::float AS avg_rating,
                   COUNT(*) AS rating_count
            FROM ratings
            GROUP BY movie_id
        ) s
        WHERE m.id = s.movie_id
    """))
    return result.rowcount


def main():
    start = time.time()
    db = SessionLocal()
    try:
        n_cf = build_cf_neighbors(db)
        n_content = build_content_neighbors(db)
        n_movies = build_rating_stats(db)
        db.commit()
        db.execute(text("ANALYZE movie_neighbors"))
        db.execute(text("ANALYZE movies"))
        db.commit()
        print(f"\nDone in {time.time() - start:.1f}s")
        print(f"  movie_neighbors (cf):      {n_cf:,} rows")
        print(f"  movie_neighbors (content): {n_content:,} rows")
        print(f"  movies with a Plotline rating: {n_movies:,}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
