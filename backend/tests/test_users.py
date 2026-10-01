def _signup_and_login(client, email="profileuser@example.com", password="password123"):
    client.post("/auth/signup", json={"email": email, "password": password})
    login_response = client.post("/auth/login", json={"email": email, "password": password})
    return login_response.json()["access_token"]


def test_change_password_requires_auth(client):
    response = client.put("/users/me/password", json={
        "current_password": "old",
        "new_password": "newpassword123",
    })
    assert response.status_code == 401


def test_change_password_success(client):
    token = _signup_and_login(client, email="pwuser@example.com", password="oldpassword123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/users/me/password",
        json={"current_password": "oldpassword123", "new_password": "newpassword456"},
        headers=headers,
    )
    assert response.status_code == 200

    login_response = client.post("/auth/login", json={
        "email": "pwuser@example.com",
        "password": "newpassword456",
    })
    assert login_response.status_code == 200


def test_change_password_wrong_current_password_fails(client):
    token = _signup_and_login(client, email="pwuser2@example.com", password="correctpass123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/users/me/password",
        json={"current_password": "wrongpass", "new_password": "newpassword456"},
        headers=headers,
    )
    assert response.status_code == 400


def test_change_password_too_short_fails(client):
    token = _signup_and_login(client, email="pwuser3@example.com", password="correctpass123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/users/me/password",
        json={"current_password": "correctpass123", "new_password": "short"},
        headers=headers,
    )
    assert response.status_code == 422


def test_change_region_requires_auth(client):
    response = client.put("/users/me/region", json={"region_preference": "IN"})
    assert response.status_code == 401


def test_change_region_success(client):
    token = _signup_and_login(client, email="regionuser@example.com")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/users/me/region",
        json={"region_preference": "in"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["region_preference"] == "IN"
