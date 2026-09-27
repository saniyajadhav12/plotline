"""
Step 1 of the ingestion pipeline: load MovieLens CSVs, select the
top N most-rated movies, and filter ratings/links down to just those.
No TMDb calls happen here — this is pure local data wrangling.
"""
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "raw" / "ml-latest-small"
TOP_N_MOVIES = 1500


def load_and_filter():
    movies = pd.read_csv(DATA_DIR / "movies.csv")
    ratings = pd.read_csv(DATA_DIR / "ratings.csv")
    links = pd.read_csv(DATA_DIR / "links.csv")

    print(f"Loaded: {len(movies)} movies, {len(ratings)} ratings, {len(links)} links")

    # Count ratings per movie, take the top N most-rated
    rating_counts = ratings.groupby("movieId").size().reset_index(name="rating_count")
    top_movies = rating_counts.sort_values("rating_count", ascending=False).head(TOP_N_MOVIES)
    top_movie_ids = set(top_movies["movieId"])

    filtered_movies = movies[movies["movieId"].isin(top_movie_ids)].copy()
    filtered_ratings = ratings[ratings["movieId"].isin(top_movie_ids)].copy()
    filtered_links = links[links["movieId"].isin(top_movie_ids)].copy()

    # Drop links with no tmdbId at all (can't enrich these from TMDb)
    filtered_links = filtered_links.dropna(subset=["tmdbId"])
    filtered_links["tmdbId"] = filtered_links["tmdbId"].astype(int)

    # Re-filter movies/ratings to only those that survived the tmdbId dropna
    valid_movie_ids = set(filtered_links["movieId"])
    filtered_movies = filtered_movies[filtered_movies["movieId"].isin(valid_movie_ids)]
    filtered_ratings = filtered_ratings[filtered_ratings["movieId"].isin(valid_movie_ids)]

    print(f"After filtering to top {TOP_N_MOVIES} most-rated movies with valid tmdbId:")
    print(f"  {len(filtered_movies)} movies, {len(filtered_ratings)} ratings, {len(filtered_links)} links")
    print(f"  {filtered_ratings['userId'].nunique()} unique users")

    return filtered_movies, filtered_ratings, filtered_links


if __name__ == "__main__":
    movies, ratings, links = load_and_filter()
    print("\nSample movies:")
    print(movies.head())
    print("\nSample links:")
    print(links.head())
