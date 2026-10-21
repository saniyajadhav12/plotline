"""Tests for the SQL-based recommenders in neighbor_recommender.py.

Each test builds a tiny catalog with hand-picked neighbor similarities, so the
expected scores can be worked out by hand:

  CF score      = sum(sim * rating) / (sum(|sim|) + CF_SHRINKAGE)
  content score = sum(sim * weight) / total weight of the user's liked movies
                  (weight 1.0 for a 4-5 star rating, 0.6 for an onboarding favorite)
"""
import uuid

import pytest

from app.core.security import hash_password
from app.models import Movie, MovieNeighbor, OnboardingPreference, Rating, User
from app.services.neighbor_recommender import (
    CF_SHRINKAGE,
    recommend_cf_from_neighbors,
    recommend_content_from_neighbors,
)


# --- tiny-world builders -------------------------------------------------------

def make_user(db):
    user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@example.com", hashed_password=hash_password("password123"))
    db.add(user)
    db.commit()
    return user


def make_movies(db, *titles, genres=None):
    movies = [
        Movie(id=uuid.uuid4(), tmdb_id=int(uuid.uuid4().int % 10_000_000), title=t, year=2020, genres=genres or ["Drama"])
        for t in titles
    ]
    db.add_all(movies)
    db.commit()
    return movies


def rate(db, user, movie, value):
    db.add(Rating(user_id=user.id, movie_id=movie.id, rating_value=value))
    db.commit()


def neighbor(db, movie, other, similarity, kind="cf"):
    db.add(MovieNeighbor(movie_id=movie.id, neighbor_id=other.id, kind=kind, similarity=similarity))
    db.commit()


def onboard(db, user, genres=None, movies=()):
    db.add(OnboardingPreference(
        user_id=user.id,
        selected_genres=genres,
        selected_movie_ids=[m.id for m in movies],
    ))
    db.commit()


# --- collaborative filtering ---------------------------------------------------

def test_cf_scores_neighbors_of_rated_movies_with_the_expected_formula(db_session):
    user = make_user(db_session)
    rated, close, far = make_movies(db_session, "Rated", "Close", "Far")
    rate(db_session, user, rated, 5)
    neighbor(db_session, rated, close, 0.9)
    neighbor(db_session, rated, far, 0.5)

    scores = recommend_cf_from_neighbors(user.id, db_session)

    assert list(scores) == [str(close.id), str(far.id)]  # ordered best first
    assert scores[str(close.id)] == pytest.approx(0.9 * 5 / (0.9 + CF_SHRINKAGE))
    assert scores[str(far.id)] == pytest.approx(0.5 * 5 / (0.5 + CF_SHRINKAGE))


def test_cf_never_suggests_movies_the_user_already_rated(db_session):
    user = make_user(db_session)
    a, b, new = make_movies(db_session, "A", "B", "New")
    rate(db_session, user, a, 5)
    rate(db_session, user, b, 4)
    neighbor(db_session, a, b, 0.9)  # b is a neighbor of a, but already rated
    neighbor(db_session, a, new, 0.4)

    scores = recommend_cf_from_neighbors(user.id, db_session)

    assert list(scores) == [str(new.id)]


def test_cf_shrinkage_prefers_broad_support_over_a_single_five_star_match(db_session):
    user = make_user(db_session)
    a, b, c, d, broad, narrow = make_movies(db_session, "A", "B", "C", "D", "Broad", "Narrow")
    for movie, value in [(a, 5), (b, 4), (c, 4), (d, 5)]:
        rate(db_session, user, movie, value)
    # "Broad" is supported by three ratings; "Narrow" by a single 5-star rating.
    for movie in (a, b, c):
        neighbor(db_session, movie, broad, 0.8)
    neighbor(db_session, d, narrow, 0.8)

    scores = recommend_cf_from_neighbors(user.id, db_session)

    # Without shrinkage, Narrow would win (5.0 vs 4.33). With it: 3.06 vs 2.22.
    assert scores[str(broad.id)] > scores[str(narrow.id)]
    assert list(scores)[0] == str(broad.id)


def test_cf_only_uses_cf_neighbors(db_session):
    user = make_user(db_session)
    rated, content_only = make_movies(db_session, "Rated", "Content only")
    rate(db_session, user, rated, 5)
    neighbor(db_session, rated, content_only, 0.9, kind="content")

    assert recommend_cf_from_neighbors(user.id, db_session) == {}


def test_cf_returns_nothing_for_a_user_without_ratings(db_session):
    user = make_user(db_session)
    a, b = make_movies(db_session, "A", "B")
    neighbor(db_session, a, b, 0.9)

    assert recommend_cf_from_neighbors(user.id, db_session) == {}


# --- content-based ---------------------------------------------------------------

def test_content_counts_four_and_five_star_ratings_as_liked_but_not_low_ratings(db_session):
    user = make_user(db_session)
    loved, disliked, like_loved, like_disliked = make_movies(db_session, "Loved", "Disliked", "Like loved", "Like disliked")
    rate(db_session, user, loved, 5)
    rate(db_session, user, disliked, 2)
    neighbor(db_session, loved, like_loved, 0.6, kind="content")
    neighbor(db_session, disliked, like_disliked, 0.9, kind="content")

    scores = recommend_content_from_neighbors(user.id, db_session)

    assert list(scores) == [str(like_loved.id)]


def test_content_uses_onboarding_favorites_with_lower_weight_and_never_suggests_them(db_session):
    user = make_user(db_session)
    rated, favorite, like_rated, like_favorite = make_movies(db_session, "Rated", "Favorite", "Like rated", "Like favorite")
    rate(db_session, user, rated, 5)
    onboard(db_session, user, genres=["Drama"], movies=[favorite])
    neighbor(db_session, rated, like_rated, 0.5, kind="content")
    neighbor(db_session, favorite, like_favorite, 0.5, kind="content")
    neighbor(db_session, rated, favorite, 0.9, kind="content")  # the favorite itself must not come back

    scores = recommend_content_from_neighbors(user.id, db_session)

    total_weight = 1.0 + 0.6
    assert list(scores) == [str(like_rated.id), str(like_favorite.id)]
    assert scores[str(like_rated.id)] == pytest.approx(0.5 * 1.0 / total_weight)
    assert scores[str(like_favorite.id)] == pytest.approx(0.5 * 0.6 / total_weight)


def test_content_falls_back_to_genre_overlap_for_a_brand_new_user(db_session):
    user = make_user(db_session)
    (both,) = make_movies(db_session, "Action comedy", genres=["Action", "Comedy"])
    (one,) = make_movies(db_session, "Action only", genres=["Action"])
    (none,) = make_movies(db_session, "Drama only", genres=["Drama"])
    onboard(db_session, user, genres=["Action", "Comedy"])

    scores = recommend_content_from_neighbors(user.id, db_session)

    assert list(scores) == [str(both.id), str(one.id)]
    assert scores[str(both.id)] == pytest.approx(1.0)
    assert scores[str(one.id)] == pytest.approx(0.5)
    assert str(none.id) not in scores


def test_content_returns_nothing_for_a_user_with_no_signal(db_session):
    user = make_user(db_session)
    make_movies(db_session, "Any movie", genres=["Action"])

    assert recommend_content_from_neighbors(user.id, db_session) == {}
