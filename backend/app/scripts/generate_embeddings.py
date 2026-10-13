"""
Generates semantic embeddings for every movie's text profile (genres +
description + cast + director, same inputs as content-based filtering)
using a local sentence-transformers model, and writes them into the
movies.embedding column for pgvector similarity search.

Runs entirely locally -- no API calls, no quota, no cost. Safe to
re-run: embeddings are recomputed and overwritten each time.
"""
import time

from sentence_transformers import SentenceTransformer

from app.core.database import SessionLocal
from app.models import Movie, CastCrew

BATCH_SIZE = 256


def build_profile_text(movie: Movie, cast_by_movie: dict, directors_by_movie: dict) -> str:
    movie_id_str = str(movie.id)
    genres_text = " ".join(movie.genres or [])
    # Repeat genre labels to weight them more heavily against purely
    # descriptive/plot text, which otherwise tends to favor documentary-
    # style factual language over genre-matching fiction (e.g. a real
    # space documentary outranking a sci-fi film for a "space" query).
    genres_text = f"{genres_text} {genres_text} {genres_text}"
    director_names = directors_by_movie.get(movie_id_str, [])
    cast_names = cast_by_movie.get(movie_id_str, [])[:5]
    description = movie.description or ""

    return f"{genres_text}. Directed by {' '.join(director_names)}. Starring {' '.join(cast_names)}. {description}"


def run():
    print("Loading embedding model (all-mpnet-base-v2)...")
    model = SentenceTransformer("all-mpnet-base-v2", device="cpu")

    db = SessionLocal()
    try:
        print("Loading movies and cast/crew data...")
        movies = db.query(Movie).all()
        cast_crew_rows = db.query(CastCrew).all()

        cast_by_movie: dict[str, list[str]] = {}
        directors_by_movie: dict[str, list[str]] = {}
        for cc in cast_crew_rows:
            movie_id_str = str(cc.movie_id)
            if cc.role == "cast":
                cast_by_movie.setdefault(movie_id_str, []).append(cc.person_name)
            elif cc.role == "director":
                directors_by_movie.setdefault(movie_id_str, []).append(cc.person_name)

        print(f"Generating embeddings for {len(movies)} movies...")
        start = time.time()

        for i in range(0, len(movies), BATCH_SIZE):
            batch = movies[i:i + BATCH_SIZE]
            texts = [build_profile_text(m, cast_by_movie, directors_by_movie) for m in batch]
            embeddings = model.encode(texts, show_progress_bar=False)

            for movie, embedding in zip(batch, embeddings):
                movie.embedding = embedding.tolist()

            db.commit()
            print(f"  {min(i + BATCH_SIZE, len(movies))}/{len(movies)} processed")

        print(f"\nDone in {time.time() - start:.1f}s")

    finally:
        db.close()


if __name__ == "__main__":
    run()
