"""Tests for the original-language filter on GET /movies and for GET /movies/languages."""
import uuid

from app.models import Movie


def add_movies(db, language, count, genres=("Drama",), prefix=None):
    movies = [
        Movie(
            id=uuid.uuid4(),
            tmdb_id=int(uuid.uuid4().int % 10_000_000),
            title=f"{prefix or language} movie {i}",
            year=2020,
            genres=list(genres),
            original_language=language,
        )
        for i in range(count)
    ]
    db.add_all(movies)
    db.commit()
    return movies


def titles(response):
    return sorted(m["title"] for m in response.json()["results"])


def test_language_filter_returns_only_that_language(client, db_session):
    add_movies(db_session, "ko", 2)
    add_movies(db_session, "en", 3)

    response = client.get("/movies", params={"language": "ko"})

    assert response.status_code == 200
    assert response.json()["total"] == 2
    assert titles(response) == ["ko movie 0", "ko movie 1"]


def test_language_filter_combines_with_genre(client, db_session):
    add_movies(db_session, "ko", 2, genres=("Thriller",), prefix="ko thriller")
    add_movies(db_session, "ko", 1, genres=("Comedy",), prefix="ko comedy")
    add_movies(db_session, "en", 2, genres=("Thriller",), prefix="en thriller")

    response = client.get("/movies", params={"language": "ko", "genre": "Thriller"})

    assert titles(response) == ["ko thriller movie 0", "ko thriller movie 1"]


def test_language_filter_is_case_insensitive(client, db_session):
    add_movies(db_session, "fr", 2)

    assert client.get("/movies", params={"language": "FR"}).json()["total"] == 2


def test_languages_endpoint_lists_counts_most_common_first_and_excludes_small_or_unknown(client, db_session):
    add_movies(db_session, "fr", 6)
    add_movies(db_session, "ko", 5)
    add_movies(db_session, "ja", 2)   # under the default minimum of 5
    add_movies(db_session, "xx", 7)   # TMDb's "no language"
    add_movies(db_session, None, 8)   # missing language

    response = client.get("/movies/languages")

    assert response.status_code == 200
    assert response.json() == [{"code": "fr", "count": 6}, {"code": "ko", "count": 5}]


def test_languages_endpoint_minimum_is_adjustable(client, db_session):
    add_movies(db_session, "ko", 5)
    add_movies(db_session, "ja", 2)

    response = client.get("/movies/languages", params={"min_movies": 1})

    assert response.status_code == 200
    assert response.json() == [{"code": "ko", "count": 5}, {"code": "ja", "count": 2}]
