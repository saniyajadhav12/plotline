"""Tests for the save step (phase 1) and the Gemini upgrade step (phase 2)."""
import uuid

from app.core.config import settings
from app.core.security import hash_password
from app.models import Movie, MovieNeighbor, Rating, RecommendationLog, User
from app.services import explanation_generator
from app.services.recommendation_generator import save_recommendations_for_user, upgrade_explanations

TEMPLATED_PREFIX = "Recommended based on your viewing history and preferences."


def make_user(db):
    user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@example.com", hashed_password=hash_password("password123"))
    db.add(user)
    db.commit()
    return user


def make_movies(db, *titles):
    movies = [Movie(id=uuid.uuid4(), tmdb_id=int(uuid.uuid4().int % 10_000_000), title=t, year=2020, genres=["Drama"])
              for t in titles]
    db.add_all(movies)
    db.commit()
    return movies


def build_world(db):
    """A user who rated one movie, with two CF neighbors and one content neighbor."""
    user = make_user(db)
    rated, cf_a, cf_b, content_c, stale = make_movies(db, "Rated", "CF A", "CF B", "Content C", "Stale")
    db.add(Rating(user_id=user.id, movie_id=rated.id, rating_value=5))
    db.add_all([
        MovieNeighbor(movie_id=rated.id, neighbor_id=cf_a.id, kind="cf", similarity=0.9),
        MovieNeighbor(movie_id=rated.id, neighbor_id=cf_b.id, kind="cf", similarity=0.5),
        MovieNeighbor(movie_id=rated.id, neighbor_id=content_c.id, kind="content", similarity=0.7),
    ])
    db.commit()
    return user, {"cf_a": cf_a, "cf_b": cf_b, "content_c": content_c, "stale": stale}


def saved_rows(db, user):
    return db.query(RecommendationLog).filter(RecommendationLog.user_id == user.id).all()


def test_save_writes_templated_recommendations_and_replaces_old_ones(db_session):
    user, movies = build_world(db_session)
    db_session.add(RecommendationLog(user_id=user.id, movie_id=movies["stale"].id, method="content",
                                     explanation_text="old", is_cached=True))
    db_session.commit()

    pending = save_recommendations_for_user(user.id, db_session)

    rows = saved_rows(db_session, user)
    expected = {str(movies[k].id) for k in ("cf_a", "cf_b", "content_c")}
    assert {str(r.movie_id) for r in rows} == expected  # the stale recommendation is gone
    assert {str(p.movie_id) for p in pending} == expected
    assert all(r.explanation_text.startswith(TEMPLATED_PREFIX) for r in rows)


def test_save_keeps_existing_recommendations_when_there_is_no_signal(db_session):
    user = make_user(db_session)
    (old,) = make_movies(db_session, "Old pick")
    db_session.add(RecommendationLog(user_id=user.id, movie_id=old.id, method="content",
                                     explanation_text="keep me", is_cached=True))
    db_session.commit()

    assert save_recommendations_for_user(user.id, db_session) == []
    assert [r.explanation_text for r in saved_rows(db_session, user)] == ["keep me"]


def test_saved_recommendations_have_valid_method_labels(db_session):
    user, _ = build_world(db_session)
    save_recommendations_for_user(user.id, db_session)

    assert {r.method for r in saved_rows(db_session, user)} <= {"collaborative", "content", "hybrid"}


def test_upgrade_without_a_gemini_key_leaves_templated_explanations(db_session, monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(explanation_generator, "_client", None)
    user, _ = build_world(db_session)
    pending = save_recommendations_for_user(user.id, db_session)
    before = {r.id: r.explanation_text for r in saved_rows(db_session, user)}

    assert upgrade_explanations(user.id, pending, db_session) == 0
    assert {r.id: r.explanation_text for r in saved_rows(db_session, user)} == before



def test_an_overloaded_gemini_stops_after_the_first_movie_in_a_batch(db_session, monkeypatch):
    from types import SimpleNamespace

    calls = {"n": 0}

    def always_overloaded(model, contents):
        calls["n"] += 1
        raise Exception("503 UNAVAILABLE: high demand")

    fake = SimpleNamespace(models=SimpleNamespace(generate_content=always_overloaded))
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(explanation_generator, "_gemini_disabled_until", 0.0)
    monkeypatch.setattr(explanation_generator, "_get_client", lambda: fake)
    monkeypatch.setattr(explanation_generator.time, "sleep", lambda seconds: None)

    user, _ = build_world(db_session)
    pending = save_recommendations_for_user(user.id, db_session)
    assert len(pending) == 3

    assert upgrade_explanations(user.id, pending, db_session) == 0
    assert calls["n"] == 3  # 3 attempts for the first movie, then paused: not 3 x 3
    assert all(r.explanation_text.startswith(TEMPLATED_PREFIX) for r in saved_rows(db_session, user))
