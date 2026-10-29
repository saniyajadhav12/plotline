def _signup_and_login(client, email="profileuser@example.com", password="password123"):
    client.post("/auth/signup", json={"name": "Test User", "email": email, "password": password})
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


def test_change_password_same_as_current_fails(client):
    token = _signup_and_login(client, email="pwuser4@example.com", password="correctpass123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.put(
        "/users/me/password",
        json={"current_password": "correctpass123", "new_password": "correctpass123"},
        headers=headers,
    )
    assert response.status_code == 400
    assert response.json()["detail"] == "New password must be different from your current password."

    login = client.post("/auth/login", json={"email": "pwuser4@example.com", "password": "correctpass123"})
    assert login.status_code == 200


def test_delete_account_requires_auth(client):
    response = client.request("DELETE", "/users/me", json={"password": "whatever123"})
    assert response.status_code == 401


def test_delete_account_wrong_password_keeps_account(client):
    token = _signup_and_login(client, email="deluser1@example.com", password="correctpass123")
    headers = {"Authorization": f"Bearer {token}"}

    response = client.request("DELETE", "/users/me", json={"password": "wrongpass123"}, headers=headers)
    assert response.status_code == 400
    assert response.json()["detail"] == "Password is incorrect"

    assert client.get("/auth/me", headers=headers).status_code == 200


def test_delete_account_removes_user_and_related_rows(client):
    email = "deluser2@example.com"
    token = _signup_and_login(client, email=email, password="correctpass123")
    headers = {"Authorization": f"Bearer {token}"}
    # Creates a password_reset_tokens row tied to this user, so the delete only
    # succeeds if the database cascades it (a missing CASCADE would raise an FK error).
    client.post("/auth/forgot-password", json={"email": email})

    response = client.request("DELETE", "/users/me", json={"password": "correctpass123"}, headers=headers)
    assert response.status_code == 200
    assert response.json()["message"] == "Account deleted"

    # The old token no longer works, the old password no longer logs in,
    # and the email is free to sign up again.
    assert client.get("/auth/me", headers=headers).status_code == 401
    login = client.post("/auth/login", json={"email": email, "password": "correctpass123"})
    assert login.status_code != 200
    signup = client.post("/auth/signup", json={"name": "Again", "email": email, "password": "newpassword123"})
    assert signup.status_code == 201
