import uuid

from app.models import Movie


def _create_movie(db_session, title="Test Movie"):
    movie = Movie(
        id=uuid.uuid4(),
        tmdb_id=int(uuid.uuid4().int % 1000000),
        title=title,
        year=2020,
        genres=["Drama"],
    )
    db_session.add(movie)
    db_session.commit()
    db_session.refresh(movie)
    return movie


def _signup_and_login(client, email="rater@example.com", password="password123"):
    client.post("/auth/signup", json={"name": "Test User", "email": email, "password": password})
    login_response = client.post("/auth/login", json={"email": email, "password": password})
    return login_response.json()["access_token"]


def test_rate_movie_requires_auth(client, db_session):
    movie = _create_movie(db_session)
    response = client.post(f"/movies/{movie.id}/ratings", json={"rating_value": 4})
    assert response.status_code == 401


def test_rate_movie_success(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)

    response = client.post(
        f"/movies/{movie.id}/ratings",
        json={"rating_value": 5},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["rating_value"] == 5
    assert data["movie_id"] == str(movie.id)


def test_rate_movie_invalid_value_fails(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)

    response = client.post(
        f"/movies/{movie.id}/ratings",
        json={"rating_value": 6},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 422


def test_rate_movie_nonexistent_movie_fails(client, db_session):
    token = _signup_and_login(client)
    response = client.post(
        f"/movies/{uuid.uuid4()}/ratings",
        json={"rating_value": 4},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_rate_movie_upserts_existing_rating(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    first = client.post(f"/movies/{movie.id}/ratings", json={"rating_value": 3}, headers=headers)
    second = client.post(f"/movies/{movie.id}/ratings", json={"rating_value": 5}, headers=headers)

    assert first.json()["id"] == second.json()["id"]
    assert second.json()["rating_value"] == 5

    my_ratings = client.get("/users/me/ratings", headers=headers)
    assert len(my_ratings.json()) == 1


def test_get_my_ratings_requires_auth(client):
    response = client.get("/users/me/ratings")
    assert response.status_code == 401


def test_get_my_ratings_includes_movie_info(client, db_session):
    movie = _create_movie(db_session, title="Rated Movie")
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(f"/movies/{movie.id}/ratings", json={"rating_value": 4}, headers=headers)

    response = client.get("/users/me/ratings", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["movie"]["title"] == "Rated Movie"
