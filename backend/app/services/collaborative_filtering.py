"""
Item-based collaborative filtering.

Builds a sparse user x movie ratings matrix (far more efficient than
a dense pandas pivot at this scale, since the matrix is >85% empty),
computes movie-movie cosine similarity based on how users rated them,
then scores unrated movies for a given user as a similarity-weighted
average of their existing ratings.
"""
import io
import uuid

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from sqlalchemy.orm import Session


class RatingsMatrix:
    """Wraps a sparse user x movie ratings matrix with id<->index lookups."""

    def __init__(self, matrix: csr_matrix, user_ids: list[str], movie_ids: list[str]):
        self.matrix = matrix
        self.user_ids = user_ids
        self.movie_ids = movie_ids
        self.user_idx = {u: i for i, u in enumerate(user_ids)}
        self.movie_idx = {m: i for i, m in enumerate(movie_ids)}

    @property
    def shape(self):
        return self.matrix.shape


def load_ratings_matrix(db: Session) -> RatingsMatrix:
    """
    Loads all ratings via a Postgres COPY (far faster than ORM or even
    a plain cursor fetch at this row count) and builds a sparse matrix.
    """
    raw_conn = db.connection().connection
    cur = raw_conn.cursor()

    buffer = io.StringIO()
    cur.copy_expert(
        "COPY (SELECT user_id, movie_id, rating_value FROM ratings) TO STDOUT WITH CSV",
        buffer,
    )
    buffer.seek(0)
    df = pd.read_csv(buffer, names=["user_id", "movie_id", "rating_value"])
    cur.close()

    df["user_id"] = df["user_id"].astype(str)
    df["movie_id"] = df["movie_id"].astype(str)

    user_ids = sorted(df["user_id"].unique().tolist())
    movie_ids = sorted(df["movie_id"].unique().tolist())
    user_idx = {u: i for i, u in enumerate(user_ids)}
    movie_idx = {m: i for i, m in enumerate(movie_ids)}

    rows = df["user_id"].map(user_idx).values
    cols = df["movie_id"].map(movie_idx).values
    vals = df["rating_value"].values

    matrix = csr_matrix((vals, (rows, cols)), shape=(len(user_ids), len(movie_ids)))
    return RatingsMatrix(matrix, user_ids, movie_ids)


def compute_item_similarity(ratings_matrix: RatingsMatrix) -> np.ndarray:
    """Returns a movie x movie cosine similarity matrix (dense numpy array)
    based on rating patterns. Movie order matches ratings_matrix.movie_ids."""
    item_vectors = ratings_matrix.matrix.T  # rows=movie, columns=user, still sparse
    return cosine_similarity(item_vectors)


def recommend_cf(
    user_id: uuid.UUID,
    ratings_matrix: RatingsMatrix,
    item_similarity: np.ndarray,
    top_n: int = 10,
) -> dict[str, float]:
    """
    Returns {movie_id: score} for the top_n unrated movies for this user,
    scored as a similarity-weighted average of the user's existing ratings.
    """
    user_id_str = str(user_id)
    if user_id_str not in ratings_matrix.user_idx:
        return {}

    user_row_idx = ratings_matrix.user_idx[user_id_str]
    user_ratings = ratings_matrix.matrix[user_row_idx].toarray().flatten()

    rated_mask = user_ratings > 0
    rated_indices = np.where(rated_mask)[0]

    if len(rated_indices) == 0:
        return {}

    unrated_indices = np.where(~rated_mask)[0]
    rated_values = user_ratings[rated_indices]

    scores = {}
    for movie_col_idx in unrated_indices:
        sims = item_similarity[movie_col_idx, rated_indices]
        weights_sum = np.abs(sims).sum()
        if weights_sum == 0:
            continue
        weighted_score = (sims * rated_values).sum() / weights_sum
        scores[movie_col_idx] = weighted_score

    top_items = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return {ratings_matrix.movie_ids[idx]: score for idx, score in top_items}
