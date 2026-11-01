"""Fallback explanations speak to "you", cite the loved movie each recommendation is
actually linked to, use only true facts, and vary across movies while staying stable
per movie. The Gemini prompt includes the story and the rules."""
import uuid
from types import SimpleNamespace

from app.core.config import settings
from app.core.security import hash_password
from app.models import CastCrew, Movie, MovieNeighbor, OnboardingPreference, Rating, User
from app.services import explanation_generator as eg

CF = {"cf_score": 0.9, "content_score": 0.0, "watchlist_boost": 0}
CONTENT = {"cf_score": 0.0, "content_score": 0.9, "watchlist_boost": 0}
NOTHING = {"cf_score": 0.0, "content_score": 0.0, "watchlist_boost": 0}
CONTENT_PHRASES = ["in common with", "spirit", "cousin", "feel familiar"]


def _user(db, genres=None):
    user = User(id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@example.com",
                hashed_password=hash_password("password123"))
    db.add(user)
    db.commit()
    if genres is not None:
        db.add(OnboardingPreference(user_id=user.id, selected_genres=genres, selected_movie_ids=[]))
        db.commit()
    return user


def _movie(db, title, genres=None, director=None):
    movie = Movie(id=uuid.uuid4(), title=title, year=2020, genres=genres or ["Drama"])
    db.add(movie)
    db.commit()
    if director:
        db.add(CastCrew(movie_id=movie.id, person_name=director, role="director"))
        db.commit()
    return movie


def _rate(db, user, movie, value):
    db.add(Rating(user_id=user.id, movie_id=movie.id, rating_value=value))
    db.commit()


def _link(db, loved, pick, kind="cf", similarity=0.9):
    db.add(MovieNeighbor(movie_id=loved.id, neighbor_id=pick.id, kind=kind, similarity=similarity))
    db.commit()


def test_fallback_speaks_to_you_not_about_the_user(db_session):
    user = _user(db_session, genres=["Drama"])
    loved = _movie(db_session, "WALL-E")
    _rate(db_session, user, loved, 5)
    pick = _movie(db_session, "Pick")
    _link(db_session, loved, pick)

    text = eg.fallback_explanation(user.id, pick, CF, db_session)

    assert "the user" not in text.lower()
    assert "WALL-E" in text


def test_cites_the_linked_movie_not_your_top_rated_one(db_session):
    user = _user(db_session)
    top = _movie(db_session, "Top Rated")
    linked = _movie(db_session, "Linked One")
    _rate(db_session, user, top, 5)
    _rate(db_session, user, linked, 4)
    pick = _movie(db_session, "Pick")
    _link(db_session, linked, pick)

    text = eg.fallback_explanation(user.id, pick, CF, db_session)

    assert "Linked One" in text
    assert "Top Rated" not in text


def test_content_link_uses_similarity_wording(db_session):
    user = _user(db_session)
    loved = _movie(db_session, "Coco")
    _rate(db_session, user, loved, 5)
    pick = _movie(db_session, "Pick")
    _link(db_session, loved, pick, kind="content")

    text = eg.fallback_explanation(user.id, pick, CONTENT, db_session)

    assert "Coco" in text
    assert any(phrase in text for phrase in CONTENT_PHRASES)


def test_no_link_means_no_movie_sentence(db_session):
    user = _user(db_session)
    _rate(db_session, user, _movie(db_session, "WALL-E"), 5)
    pick = _movie(db_session, "Unrelated")

    text = eg.fallback_explanation(user.id, pick, CF, db_session)

    assert "WALL-E" not in text


def test_director_link_names_the_other_movie_and_your_rating(db_session):
    user = _user(db_session)
    _rate(db_session, user, _movie(db_session, "WALL-E", director="Andrew Stanton"), 5)
    pick = _movie(db_session, "Finding Nemo", director="Andrew Stanton")

    text = eg.fallback_explanation(user.id, pick, NOTHING, db_session)

    assert "Andrew Stanton" in text and "WALL-E" in text and "5/5" in text


def test_no_director_link_unless_you_rated_their_other_movie_highly(db_session):
    user = _user(db_session)
    _rate(db_session, user, _movie(db_session, "Meh", director="Andrew Stanton"), 2)
    pick = _movie(db_session, "Pick", director="Andrew Stanton")

    text = eg.fallback_explanation(user.id, pick, NOTHING, db_session)

    assert "Andrew Stanton" not in text


def test_genre_sentence_only_mentions_genres_you_picked(db_session):
    user = _user(db_session, genres=["Science Fiction", "Comedy"])
    pick = _movie(db_session, "Pick", genres=["Science Fiction", "Horror"])

    text = eg.fallback_explanation(user.id, pick, NOTHING, db_session)

    assert "Science Fiction" in text
    assert "Horror" not in text


def test_missing_director_and_genres_never_leave_gaps(db_session):
    user = _user(db_session)
    bare = Movie(id=uuid.uuid4(), title="Bare", year=None, genres=[])
    db_session.add(bare)
    db_session.commit()

    text = eg.fallback_explanation(user.id, bare, CONTENT, db_session)

    assert text
    assert "directed by" not in text
    assert " ," not in text and "()" not in text


def test_variant_varies_across_movies_and_is_stable_per_movie():
    options = ["a", "b", "c", "d"]
    movies = [SimpleNamespace(id=uuid.UUID(int=i)) for i in range(1, 41)]

    picks = [eg._variant(m, "link", options) for m in movies]

    assert picks == [eg._variant(m, "link", options) for m in movies]
    assert set(picks) == set(options)


def test_sentence_order_varies_across_movies():
    signals = eg._Signals(link=("WALL-E", "cf"), director_link=None, directors=[],
                          movie_genres=["Animation"], picked_genres=["Animation"],
                          content_strong=False, on_watchlist=False)
    movies = [SimpleNamespace(id=uuid.UUID(int=i)) for i in range(1, 41)]

    texts = [eg._user_facing_text(signals, m) for m in movies]

    assert any(t.index("WALL-E") < t.index("Animation") for t in texts)
    assert any(t.index("Animation") < t.index("WALL-E") for t in texts)


def test_gemini_prompt_includes_the_story_and_the_rules(monkeypatch):
    captured = {}

    def generate_content(model, contents):
        captured["prompt"] = contents
        return SimpleNamespace(text="Nice.")

    client = SimpleNamespace(models=SimpleNamespace(generate_content=generate_content))
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(eg, "_gemini_disabled_until", 0.0)
    monkeypatch.setattr(eg, "_get_client", lambda: client)
    monkeypatch.setattr(eg, "_get_signal_context", lambda *args: "The user rated WALL-E highly.")
    movie = SimpleNamespace(title="Finding Nemo", year=2003, genres=["Animation", "Family"],
                            description="A clownfish crosses the ocean to find his son. " * 30)

    assert eg.try_gemini_explanation(None, movie, {}, None) == "Nice."

    prompt = captured["prompt"]
    assert "Finding Nemo (2003)" in prompt
    assert "Animation, Family" in prompt
    assert "A clownfish crosses the ocean" in prompt
    assert "don't invent" in prompt
    summary_line = next(line for line in prompt.splitlines() if line.startswith("Plot summary:"))
    assert len(summary_line) <= len("Plot summary: ") + eg.PROMPT_SUMMARY_CHARS + 1


def test_equally_strong_links_rotate_between_your_movies(db_session):
    user = _user(db_session)
    wall_e, inside_out = _movie(db_session, "WALL-E"), _movie(db_session, "Inside Out")
    _rate(db_session, user, wall_e, 4)
    _rate(db_session, user, inside_out, 4)

    cited = set()
    for i in range(20):
        pick = _movie(db_session, f"Pick {i}")
        _link(db_session, wall_e, pick, similarity=0.88)
        _link(db_session, inside_out, pick, similarity=0.76)
        text = eg.fallback_explanation(user.id, pick, CF, db_session)
        cited |= {title for title in ("WALL-E", "Inside Out") if title in text}

    assert cited == {"WALL-E", "Inside Out"}


def test_a_much_weaker_link_is_never_cited(db_session):
    user = _user(db_session)
    strong, weak = _movie(db_session, "Strong Link"), _movie(db_session, "Weak Link")
    _rate(db_session, user, strong, 4)
    _rate(db_session, user, weak, 4)

    for i in range(10):
        pick = _movie(db_session, f"Pick {i}")
        _link(db_session, strong, pick, similarity=0.9)
        _link(db_session, weak, pick, similarity=0.5)
        assert "Weak Link" not in eg.fallback_explanation(user.id, pick, CF, db_session)


def test_a_higher_rated_link_always_wins(db_session):
    user = _user(db_session)
    loved, liked = _movie(db_session, "Loved Five"), _movie(db_session, "Liked Four")
    _rate(db_session, user, loved, 5)
    _rate(db_session, user, liked, 4)

    for i in range(10):
        pick = _movie(db_session, f"Pick {i}")
        _link(db_session, loved, pick, similarity=0.5)
        _link(db_session, liked, pick, similarity=0.95)
        text = eg.fallback_explanation(user.id, pick, CF, db_session)
        assert "Loved Five" in text and "Liked Four" not in text
