import uuid

from app.models import Movie, RecommendationLog


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


def _signup_and_login(client, email="recuser@example.com", password="password123"):
    client.post("/auth/signup", json={"email": email, "password": password})
    login_response = client.post("/auth/login", json={"email": email, "password": password})
    return login_response.json()["access_token"]


def test_get_recommendations_requires_auth(client):
    response = client.get("/users/me/recommendations")
    assert response.status_code == 401


def test_get_recommendations_empty_when_none_cached(client):
    token = _signup_and_login(client)
    response = client.get("/users/me/recommendations", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []


def test_get_recommendations_returns_cached_logs(client, db_session):
    from app.models import User
    from app.core.security import hash_password

    user = User(id=uuid.uuid4(), email="reccached@example.com", hashed_password=hash_password("password123"))
    db_session.add(user)
    db_session.commit()

    movie = _create_movie(db_session, title="Recommended Movie")

    db_session.add(RecommendationLog(
        user_id=user.id,
        movie_id=movie.id,
        method="hybrid",
        explanation_text="Because you liked similar movies.",
        is_cached=True,
    ))
    db_session.commit()

    login_response = client.post("/auth/login", json={"email": "reccached@example.com", "password": "password123"})
    token = login_response.json()["access_token"]

    response = client.get("/users/me/recommendations", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["movie"]["title"] == "Recommended Movie"
    assert data[0]["method"] == "hybrid"
    assert data[0]["explanation_text"] == "Because you liked similar movies."


def test_get_recommendations_only_returns_own_recommendations(client, db_session):
    from app.models import User
    from app.core.security import hash_password

    user_a = User(id=uuid.uuid4(), email="usera@example.com", hashed_password=hash_password("password123"))
    user_b = User(id=uuid.uuid4(), email="userb@example.com", hashed_password=hash_password("password123"))
    db_session.add_all([user_a, user_b])
    db_session.commit()

    movie = _create_movie(db_session)

    db_session.add(RecommendationLog(
        user_id=user_b.id, movie_id=movie.id, method="content",
        explanation_text="For user B", is_cached=True,
    ))
    db_session.commit()

    login_response = client.post("/auth/login", json={"email": "usera@example.com", "password": "password123"})
    token = login_response.json()["access_token"]

    response = client.get("/users/me/recommendations", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []
