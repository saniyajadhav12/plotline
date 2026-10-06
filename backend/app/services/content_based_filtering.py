"""
Content-based filtering.

Builds a text profile per movie from genres, description, top cast,
and director, vectorizes with TF-IDF, and computes movie-movie cosine
similarity based on content.

For a user, blends two signal sources to find "liked" movies:
  - Movies they rated 4-5 stars (weight 1.0 — proven behavior)
  - Movies they picked as favorites during onboarding (weight 0.6 —
    stated preference, before any real usage)
If neither exists but the user selected favorite genres during
onboarding, falls back to a pure genre-overlap score so a brand-new
user still gets a first batch of recommendations before rating
anything.
"""
import uuid

import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.models import Movie, CastCrew, Rating, OnboardingPreference

RATING_LIKE_WEIGHT = 1.0
ONBOARDING_MOVIE_WEIGHT = 0.6


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


def _genre_overlap_scores(
    db: Session,
    selected_genres: list[str],
    exclude_movie_ids: set[str],
    top_n: int,
) -> dict[str, float]:
    """Cold-start fallback: score every unrated/unselected movie by the
    fraction of the user's chosen genres it matches, when there's no
    rating or favorite-movie signal to lean on yet."""
    if not selected_genres:
        return {}

    selected_set = set(selected_genres)
    movies = db.query(Movie.id, Movie.genres).filter(Movie.genres.isnot(None)).all()

    scores = {}
    for movie_id, genres in movies:
        movie_id_str = str(movie_id)
        if movie_id_str in exclude_movie_ids:
            continue
        if not genres:
            continue
        overlap = len(selected_set & set(genres))
        if overlap > 0:
            scores[movie_id_str] = overlap / len(selected_set)

    return dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n])


def recommend_content_based(
    user_id: uuid.UUID,
    db: Session,
    content_similarity: pd.DataFrame,
    top_n: int = 10,
) -> dict[str, float]:
    """
    Returns {movie_id: score} for the top_n unrated movies for this user,
    scored by a weighted-average content similarity to the user's "liked"
    movies (ratings >=4, blended with onboarding favorite-movie picks).
    Falls back to pure genre overlap if neither signal exists yet.
    """
    rated_movie_ids = {str(r.movie_id) for r in db.query(Rating).filter(Rating.user_id == user_id).all()}

    liked_ratings = (
        db.query(Rating)
        .filter(Rating.user_id == user_id, Rating.rating_value >= 4)
        .all()
    )
    weighted_likes: dict[str, float] = {str(r.movie_id): RATING_LIKE_WEIGHT for r in liked_ratings}

    onboarding = (
        db.query(OnboardingPreference)
        .filter(OnboardingPreference.user_id == user_id)
        .first()
    )
    onboarding_movie_ids = [str(m) for m in (onboarding.selected_movie_ids or [])] if onboarding else []
    onboarding_genres = onboarding.selected_genres if onboarding else []

    for movie_id in onboarding_movie_ids:
        # Don't let an onboarding pick override a real rating-based weight
        weighted_likes.setdefault(movie_id, ONBOARDING_MOVIE_WEIGHT)

    # Exclude anything already rated or already picked as an onboarding favorite
    # from candidates — no need to recommend back something they've already told us about
    exclude_ids = rated_movie_ids | set(onboarding_movie_ids)

    weighted_likes = {m: w for m, w in weighted_likes.items() if m in content_similarity.index}

    if not weighted_likes:
        # True cold start: no ratings, no onboarding favorite movies.
        # Fall back to genre overlap if they at least picked genres.
        return _genre_overlap_scores(db, onboarding_genres or [], exclude_ids, top_n)

    all_movie_ids = set(content_similarity.index)
    candidate_ids = all_movie_ids - exclude_ids

    liked_ids = list(weighted_likes.keys())
    weights = pd.Series(weighted_likes)

    scores = {}
    for movie_id in candidate_ids:
        sims = content_similarity.loc[movie_id, liked_ids]
        weighted_sum = (sims * weights).sum()
        weight_total = weights.sum()
        if weight_total == 0:
            continue
        scores[movie_id] = weighted_sum / weight_total

    top_scores = dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n])
    return top_scores
