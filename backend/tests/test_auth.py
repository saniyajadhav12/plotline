def test_signup_creates_user(client):
    response = client.post("/auth/signup", json={
        "name": "Alice Smith",
        "email": "alice@example.com",
        "password": "securepassword123",
    })
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Alice Smith"
    assert data["email"] == "alice@example.com"
    assert "id" in data
    assert data["region_preference"] == "US"


def test_signup_duplicate_email_fails(client):
    client.post("/auth/signup", json={"name": "Bob", "email": "bob@example.com", "password": "password123"})
    response = client.post("/auth/signup", json={"name": "Bob", "email": "bob@example.com", "password": "differentpass"})
    assert response.status_code == 409


def test_signup_invalid_email_fails(client):
    response = client.post("/auth/signup", json={"name": "Carol", "email": "not-an-email", "password": "password123"})
    assert response.status_code == 422


def test_signup_short_password_fails(client):
    response = client.post("/auth/signup", json={"name": "Carol", "email": "carol@example.com", "password": "short"})
    assert response.status_code == 422


def test_login_success(client):
    client.post("/auth/signup", json={"name": "Dave", "email": "dave@example.com", "password": "correctpassword"})
    response = client.post("/auth/login", json={"email": "dave@example.com", "password": "correctpassword"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_login_wrong_password_fails(client):
    client.post("/auth/signup", json={"name": "Erin", "email": "erin@example.com", "password": "correctpassword"})
    response = client.post("/auth/login", json={"email": "erin@example.com", "password": "wrongpassword"})
    assert response.status_code == 401


def test_login_nonexistent_user_fails(client):
    response = client.post("/auth/login", json={"email": "ghost@example.com", "password": "anything"})
    assert response.status_code == 401


def test_me_with_valid_token(client):
    client.post("/auth/signup", json={"name": "Frank", "email": "frank@example.com", "password": "mypassword123"})
    login_response = client.post("/auth/login", json={"email": "frank@example.com", "password": "mypassword123"})
    token = login_response.json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "frank@example.com"
    assert response.json()["name"] == "Frank"


def test_me_without_token_fails(client):
    response = client.get("/auth/me")
    assert response.status_code == 401


def test_me_with_invalid_token_fails(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert response.status_code == 401


def test_forgot_password_and_reset_flow(client, db_session, capsys):
    from app.models import PasswordResetToken

    client.post("/auth/signup", json={"name": "Grace", "email": "grace@example.com", "password": "oldpassword123"})

    forgot_response = client.post("/auth/forgot-password", json={"email": "grace@example.com"})
    assert forgot_response.status_code == 200

    token_row = db_session.query(PasswordResetToken).first()
    assert token_row is not None

    reset_response = client.post("/auth/reset-password", json={
        "token": token_row.token,
        "new_password": "newpassword456",
    })
    assert reset_response.status_code == 200

    login_response = client.post("/auth/login", json={
        "email": "grace@example.com",
        "password": "newpassword456",
    })
    assert login_response.status_code == 200


def test_reset_password_invalid_token_fails(client):
    response = client.post("/auth/reset-password", json={
        "token": "totally-invalid-token",
        "new_password": "newpassword456",
    })
    assert response.status_code == 400


def test_forgot_password_nonexistent_email_still_returns_200(client):
    response = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
    assert response.status_code == 200
