import uuid

from app.models import Movie


def _create_movie(db_session, title="Test Movie", genres=None, tmdb_id=None):
    movie = Movie(
        id=uuid.uuid4(),
        tmdb_id=tmdb_id or int(uuid.uuid4().int % 1000000),
        movielens_id=None,
        title=title,
        year=2020,
        genres=genres or ["Drama"],
        description="A test movie.",
        poster_url="http://example.com/poster.jpg",
    )
    db_session.add(movie)
    db_session.commit()
    db_session.refresh(movie)
    return movie


def test_list_movies_empty(client):
    response = client.get("/movies")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["results"] == []


def test_list_movies_search_by_title(client, db_session):
    _create_movie(db_session, title="Inception")
    _create_movie(db_session, title="Interstellar")
    _create_movie(db_session, title="The Matrix")

    response = client.get("/movies?q=inter")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["results"][0]["title"] == "Interstellar"


def test_list_movies_filter_by_genre(client, db_session):
    _create_movie(db_session, title="Comedy Movie", genres=["Comedy"])
    _create_movie(db_session, title="Drama Movie", genres=["Drama"])

    response = client.get("/movies?genre=Comedy")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["results"][0]["title"] == "Comedy Movie"


def test_list_movies_pagination(client, db_session):
    for i in range(5):
        _create_movie(db_session, title=f"Movie {i}")

    response = client.get("/movies?page=1&page_size=2")
    data = response.json()
    assert data["total"] == 5
    assert len(data["results"]) == 2

    response2 = client.get("/movies?page=2&page_size=2")
    data2 = response2.json()
    assert len(data2["results"]) == 2
    assert data["results"][0]["id"] != data2["results"][0]["id"]


def test_get_movie_detail(client, db_session):
    movie = _create_movie(db_session, title="Detail Test Movie")

    response = client.get(f"/movies/{movie.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Detail Test Movie"
    assert data["average_rating"] is None
    assert data["cast"] == []
    assert data["director"] == []
    assert data["watch_providers"] == []


def test_get_movie_detail_not_found(client):
    response = client.get(f"/movies/{uuid.uuid4()}")
    assert response.status_code == 404


def test_list_genres_returns_sorted_distinct_genres(client, db_session):
    _create_movie(db_session, title="Movie A", genres=["Comedy", "Drama"])
    _create_movie(db_session, title="Movie B", genres=["Action", "Comedy"])

    response = client.get("/movies/genres")
    assert response.status_code == 200
    data = response.json()
    assert data == sorted(set(["Comedy", "Drama", "Action"]))


def test_list_movies_sort_by_popularity(client, db_session):
    from app.models import Rating, User
    from app.core.security import hash_password

    popular = _create_movie(db_session, title="Popular Movie")
    _unpopular = _create_movie(db_session, title="Unpopular Movie")

    user1 = User(id=uuid.uuid4(), email="rater1@example.com", hashed_password=hash_password("password123"))
    user2 = User(id=uuid.uuid4(), email="rater2@example.com", hashed_password=hash_password("password123"))
    db_session.add_all([user1, user2])
    db_session.commit()

    db_session.add(Rating(user_id=user1.id, movie_id=popular.id, rating_value=5))
    db_session.add(Rating(user_id=user2.id, movie_id=popular.id, rating_value=4))
    db_session.commit()

    response = client.get("/movies?sort=popularity")
    assert response.status_code == 200
    data = response.json()
    titles = [m["title"] for m in data["results"]]
    assert titles.index("Popular Movie") < titles.index("Unpopular Movie")
