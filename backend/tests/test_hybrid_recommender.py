"""Tests for hybrid_recommender.py: normalization, blend weights, boosts, ranking."""
import uuid

import pytest

from app.core.security import hash_password
from app.models import Movie, User, Watchlist
from app.services.hybrid_recommender import (
    CF_WEIGHT,
    CONTENT_WEIGHT,
    WATCHLIST_WEIGHT,
    _normalize,
    compute_hybrid_scores,
    determine_primary_method,
)


def make_user(db):
    user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@example.com", hashed_password=hash_password("password123"))
    db.add(user)
    db.commit()
    return user


def make_movie(db, title, year=2020, popularity=None):
    movie = Movie(id=uuid.uuid4(), tmdb_id=int(uuid.uuid4().int % 10_000_000), title=title,
                  year=year, popularity_score=popularity, genres=["Drama"])
    db.add(movie)
    db.commit()
    return movie


def test_normalize_scales_to_zero_one_and_handles_edge_cases():
    assert _normalize({"a": 2.0, "b": 4.0, "c": 3.0}) == {"a": 0.0, "b": 1.0, "c": 0.5}
    assert _normalize({"a": 7.0, "b": 7.0}) == {"a": 1.0, "b": 1.0}
    assert _normalize({}) == {}


def test_a_movie_top_in_both_signals_gets_the_combined_cf_and_content_weight(db_session):
    user = make_user(db_session)
    top, low = make_movie(db_session, "Top"), make_movie(db_session, "Low")
    cf = {str(top.id): 2.0, str(low.id): 1.0}
    content = {str(top.id): 0.5, str(low.id): 0.1}

    results = compute_hybrid_scores(user.id, db_session, cf, content)

    assert [movie_id for movie_id, _, _ in results] == [str(top.id), str(low.id)]
    _, top_score, breakdown = results[0]
    # Same year and no popularity data, so the popularity boost is 0 for both.
    assert top_score == pytest.approx(CF_WEIGHT + CONTENT_WEIGHT)
    assert breakdown["cf_score"] == 1.0 and breakdown["content_score"] == 1.0


def test_watchlisted_candidates_get_the_watchlist_boost(db_session):
    user = make_user(db_session)
    a, watchlisted = make_movie(db_session, "A"), make_movie(db_session, "Watchlisted")
    db_session.add(Watchlist(user_id=user.id, movie_id=watchlisted.id))
    db_session.commit()

    results = dict((m, (s, b)) for m, s, b in compute_hybrid_scores(
        user.id, db_session, {str(a.id): 2.0, str(watchlisted.id): 1.0}, {}
    ))

    score, breakdown = results[str(watchlisted.id)]
    assert breakdown["watchlist_boost"] == 1.0
    assert score == pytest.approx(WATCHLIST_WEIGHT)  # lowest CF score normalizes to 0


def test_popularity_and_recency_break_ties(db_session):
    user = make_user(db_session)
    older = make_movie(db_session, "Older, less popular", year=2000, popularity=10.0)
    newer = make_movie(db_session, "Newer, more popular", year=2020, popularity=100.0)

    results = compute_hybrid_scores(user.id, db_session, {str(older.id): 1.0, str(newer.id): 1.0}, {})

    assert results[0][0] == str(newer.id)
    assert results[0][2]["popularity_boost"] == 1.0
    assert results[1][2]["popularity_boost"] == 0.0


def test_top_n_limits_the_results_best_first(db_session):
    user = make_user(db_session)
    movies = [make_movie(db_session, f"M{i}") for i in range(5)]
    cf = {str(m.id): float(i) for i, m in enumerate(movies)}

    results = compute_hybrid_scores(user.id, db_session, cf, {}, top_n=2)

    assert [movie_id for movie_id, _, _ in results] == [str(movies[4].id), str(movies[3].id)]


def test_primary_method_is_hybrid_when_both_signals_are_close():
    assert determine_primary_method({"cf_score": 0.8, "content_score": 0.75}) == "hybrid"


def test_primary_method_follows_the_clearly_stronger_signal():
    assert determine_primary_method({"cf_score": 0.9, "content_score": 0.2}) == "collaborative"
    assert determine_primary_method({"cf_score": 0.1, "content_score": 0.8}) == "content"


def test_primary_method_for_a_content_only_pick_that_normalized_to_zero_is_content():
    # Lowest scorer in the content list (normalized to 0) and never found by CF.
    # Previously labeled "collaborative" because 0 >= 0.
    breakdown = {"cf_score": 0.0, "content_score": 0.0, "raw_cf_score": None, "raw_content_score": 0.12}
    assert determine_primary_method(breakdown) == "content"


def test_primary_method_when_both_signals_found_it_but_both_normalized_to_zero_is_hybrid():
    breakdown = {"cf_score": 0.0, "content_score": 0.0, "raw_cf_score": 1.4, "raw_content_score": 0.12}
    assert determine_primary_method(breakdown) == "hybrid"
