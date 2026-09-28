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


def _signup_and_login(client, email="watcher@example.com", password="password123"):
    client.post("/auth/signup", json={"email": email, "password": password})
    login_response = client.post("/auth/login", json={"email": email, "password": password})
    return login_response.json()["access_token"]


def test_add_to_watchlist_requires_auth(client, db_session):
    movie = _create_movie(db_session)
    response = client.post(f"/movies/{movie.id}/watchlist")
    assert response.status_code == 401


def test_add_to_watchlist_success(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)

    response = client.post(
        f"/movies/{movie.id}/watchlist",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201


def test_add_to_watchlist_nonexistent_movie_fails(client, db_session):
    token = _signup_and_login(client)
    response = client.post(
        f"/movies/{uuid.uuid4()}/watchlist",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_add_to_watchlist_twice_does_not_duplicate(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(f"/movies/{movie.id}/watchlist", headers=headers)
    client.post(f"/movies/{movie.id}/watchlist", headers=headers)

    response = client.get("/users/me/watchlist", headers=headers)
    assert len(response.json()) == 1


def test_get_watchlist_includes_movie_info(client, db_session):
    movie = _create_movie(db_session, title="Watchlist Movie")
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(f"/movies/{movie.id}/watchlist", headers=headers)

    response = client.get("/users/me/watchlist", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["movie"]["title"] == "Watchlist Movie"


def test_remove_from_watchlist_success(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(f"/movies/{movie.id}/watchlist", headers=headers)
    response = client.delete(f"/movies/{movie.id}/watchlist", headers=headers)
    assert response.status_code == 200

    watchlist = client.get("/users/me/watchlist", headers=headers)
    assert watchlist.json() == []


def test_remove_from_watchlist_not_present_fails(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    response = client.delete(f"/movies/{movie.id}/watchlist", headers=headers)
    assert response.status_code == 404
