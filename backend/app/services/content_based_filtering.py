"""
Content-based filtering.

Builds a text profile per movie from genres, description, top cast,
and director, vectorizes with TF-IDF, and computes movie-movie cosine
similarity based on content. For a user, aggregates the profiles of
movies they rated highly to score unrated movies.
"""
import uuid

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.models import Movie, CastCrew, Rating


def build_movie_profiles(db: Session) -> pd.DataFrame:
    """Returns a DataFrame: index=movie_id, column='profile_text' (combined text features)."""
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

    records = []
    for movie in movies:
        movie_id_str = str(movie.id)
        genres_text = " ".join(movie.genres or [])
        # Weight genres and director more heavily by repeating them
        genres_text = (genres_text + " ") * 3
        director_names = directors_by_movie.get(movie_id_str, [])
        director_text = (" ".join(director_names) + " ") * 2
        cast_text = " ".join(cast_by_movie.get(movie_id_str, [])[:5])
        description_text = movie.description or ""

        profile_text = f"{genres_text} {director_text} {cast_text} {description_text}"
        records.append({"movie_id": movie_id_str, "profile_text": profile_text})

    df = pd.DataFrame(records).set_index("movie_id")
    return df


def compute_content_similarity(movie_profiles: pd.DataFrame) -> pd.DataFrame:
    """Returns a movie x movie cosine similarity DataFrame based on TF-IDF content vectors."""
    vectorizer = TfidfVectorizer(stop_words="english", max_features=5000)
    tfidf_matrix = vectorizer.fit_transform(movie_profiles["profile_text"])
    similarity = cosine_similarity(tfidf_matrix)
    return pd.DataFrame(similarity, index=movie_profiles.index, columns=movie_profiles.index)


def recommend_content_based(
    user_id: uuid.UUID,
    db: Session,
    content_similarity: pd.DataFrame,
    top_n: int = 10,
) -> dict[str, float]:
    """
    Returns {movie_id: score} for the top_n unrated movies for this user,
    scored by average content similarity to movies the user rated >= 4.
    """
    user_id_str = str(user_id)

    liked_ratings = (
        db.query(Rating)
        .filter(Rating.user_id == user_id, Rating.rating_value >= 4)
        .all()
    )
    liked_movie_ids = [str(r.movie_id) for r in liked_ratings]

    if not liked_movie_ids:
        return {}

    rated_movie_ids = {str(r.movie_id) for r in db.query(Rating).filter(Rating.user_id == user_id).all()}
    all_movie_ids = set(content_similarity.index)
    unrated_movie_ids = all_movie_ids - rated_movie_ids

    liked_movie_ids = [m for m in liked_movie_ids if m in content_similarity.index]
    if not liked_movie_ids:
        return {}

    scores = {}
    for movie_id in unrated_movie_ids:
        sims = content_similarity.loc[movie_id, liked_movie_ids]
        scores[movie_id] = sims.mean()

    top_scores = dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n])
    return top_scores
