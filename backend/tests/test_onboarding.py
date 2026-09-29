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


def _signup_and_login(client, email="onboard@example.com", password="password123"):
    client.post("/auth/signup", json={"email": email, "password": password})
    login_response = client.post("/auth/login", json={"email": email, "password": password})
    return login_response.json()["access_token"]


def test_save_onboarding_requires_auth(client):
    response = client.post("/users/me/onboarding", json={
        "selected_genres": ["Comedy"],
        "selected_movie_ids": [],
    })
    assert response.status_code == 401


def test_save_onboarding_success(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)

    response = client.post(
        "/users/me/onboarding",
        json={"selected_genres": ["Comedy", "Drama"], "selected_movie_ids": [str(movie.id)]},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["selected_genres"] == ["Comedy", "Drama"]
    assert data["selected_movie_ids"] == [str(movie.id)]


def test_save_onboarding_upserts(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/users/me/onboarding",
        json={"selected_genres": ["Comedy"], "selected_movie_ids": []},
        headers=headers,
    )
    response = client.post(
        "/users/me/onboarding",
        json={"selected_genres": ["Horror", "Thriller"], "selected_movie_ids": [str(movie.id)]},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["selected_genres"] == ["Horror", "Thriller"]


def test_get_onboarding_requires_auth(client):
    response = client.get("/users/me/onboarding")
    assert response.status_code == 401


def test_get_onboarding_returns_none_when_not_set(client):
    token = _signup_and_login(client)
    response = client.get(
        "/users/me/onboarding",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["selected_genres"] is None
    assert data["selected_movie_ids"] is None


def test_get_onboarding_returns_saved_preferences(client, db_session):
    movie = _create_movie(db_session)
    token = _signup_and_login(client)
    headers = {"Authorization": f"Bearer {token}"}

    client.post(
        "/users/me/onboarding",
        json={"selected_genres": ["Sci-Fi"], "selected_movie_ids": [str(movie.id)]},
        headers=headers,
    )

    response = client.get("/users/me/onboarding", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["selected_genres"] == ["Sci-Fi"]
    assert data["selected_movie_ids"] == [str(movie.id)]
