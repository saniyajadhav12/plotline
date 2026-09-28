"""
Item-based collaborative filtering.

Builds a user x movie ratings matrix, computes movie-movie cosine
similarity based on how users rated them, then scores unrated movies
for a given user as a similarity-weighted average of their existing
ratings.
"""
import uuid

import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session

from app.models import Rating


def load_ratings_matrix(db: Session) -> pd.DataFrame:
    """Returns a DataFrame: rows=user_id, columns=movie_id, values=rating_value (0 where unrated)."""
    ratings = db.query(Rating.user_id, Rating.movie_id, Rating.rating_value).all()
    df = pd.DataFrame(ratings, columns=["user_id", "movie_id", "rating_value"])
    df["user_id"] = df["user_id"].astype(str)
    df["movie_id"] = df["movie_id"].astype(str)

    matrix = df.pivot_table(index="user_id", columns="movie_id", values="rating_value", fill_value=0)
    return matrix


def compute_item_similarity(ratings_matrix: pd.DataFrame) -> pd.DataFrame:
    """Returns a movie x movie cosine similarity DataFrame based on rating patterns."""
    item_vectors = ratings_matrix.T  # rows=movie_id, columns=user_id
    similarity = cosine_similarity(item_vectors)
    return pd.DataFrame(similarity, index=item_vectors.index, columns=item_vectors.index)


def recommend_cf(
    user_id: uuid.UUID,
    ratings_matrix: pd.DataFrame,
    item_similarity: pd.DataFrame,
    top_n: int = 10,
) -> dict[str, float]:
    """
    Returns {movie_id: score} for the top_n unrated movies for this user,
    scored as a similarity-weighted average of the user's existing ratings.
    """
    user_id_str = str(user_id)
    if user_id_str not in ratings_matrix.index:
        return {}

    user_ratings = ratings_matrix.loc[user_id_str]
    rated_movie_ids = user_ratings[user_ratings > 0].index.tolist()

    if not rated_movie_ids:
        return {}

    unrated_movie_ids = user_ratings[user_ratings == 0].index.tolist()

    scores = {}
    for movie_id in unrated_movie_ids:
        sims = item_similarity.loc[movie_id, rated_movie_ids]
        weights_sum = sims.abs().sum()
        if weights_sum == 0:
            continue
        weighted_score = (sims * user_ratings[rated_movie_ids]).sum() / weights_sum
        scores[movie_id] = weighted_score

    top_scores = dict(sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n])
    return top_scores
