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


# --- the reset token must never leave the server outside development ---------------

def test_forgot_password_does_not_return_the_token_by_default(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "expose_reset_token_in_response", False)
    client.post("/auth/signup", json={"name": "Ada", "email": "ada@example.com", "password": "password123"})

    response = client.post("/auth/forgot-password", json={"email": "ada@example.com"})

    assert response.status_code == 200
    assert "dev_reset_token" not in response.json()


def test_forgot_password_response_is_identical_for_known_and_unknown_emails(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "expose_reset_token_in_response", False)
    client.post("/auth/signup", json={"name": "Ada", "email": "ada@example.com", "password": "password123"})

    known = client.post("/auth/forgot-password", json={"email": "ada@example.com"})
    unknown = client.post("/auth/forgot-password", json={"email": "nobody@example.com"})

    assert known.json() == unknown.json()


def test_forgot_password_returns_the_token_only_in_dev_mode(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "expose_reset_token_in_response", True)
    client.post("/auth/signup", json={"name": "Ada", "email": "ada@example.com", "password": "password123"})

    response = client.post("/auth/forgot-password", json={"email": "ada@example.com"})

    assert response.json()["dev_reset_token"]


# --- reset tokens are only handed to the frontend's server, and rate limited -------

INTERNAL_KEY = "test-internal-key"


def _signup(client, email="eve@example.com"):
    client.post("/auth/signup", json={"name": "Eve", "email": email, "password": "password123"})


def _forgot(client, email="eve@example.com", key=None):
    headers = {"X-Internal-Key": key} if key is not None else {}
    return client.post("/auth/forgot-password", json={"email": email}, headers=headers)


def test_internal_key_returns_a_working_reset_token(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "internal_api_key", INTERNAL_KEY)
    _signup(client)

    token = _forgot(client, key=INTERNAL_KEY).json()["reset_token"]

    reset = client.post("/auth/reset-password", json={"token": token, "new_password": "brandnew456"})
    assert reset.status_code == 200
    login = client.post("/auth/login", json={"email": "eve@example.com", "password": "brandnew456"})
    assert login.status_code == 200


def test_wrong_internal_key_returns_no_token(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "internal_api_key", INTERNAL_KEY)
    _signup(client)

    assert "reset_token" not in _forgot(client, key="guess").json()


def test_missing_internal_key_returns_no_token(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "internal_api_key", INTERNAL_KEY)
    _signup(client)

    assert "reset_token" not in _forgot(client).json()


def test_an_unconfigured_secret_never_matches(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "internal_api_key", "")
    _signup(client)

    assert "reset_token" not in _forgot(client, key="").json()


def test_reset_requests_are_rate_limited_per_account(client, db_session, monkeypatch):
    from app.core.config import settings
    from app.models import PasswordResetToken
    monkeypatch.setattr(settings, "internal_api_key", INTERNAL_KEY)
    _signup(client)

    for _ in range(3):
        assert "reset_token" in _forgot(client, key=INTERNAL_KEY).json()
    fourth = _forgot(client, key=INTERNAL_KEY)

    assert fourth.status_code == 200
    assert "reset_token" not in fourth.json()
    assert db_session.query(PasswordResetToken).count() == 3


def test_unknown_email_returns_no_token_even_with_the_internal_key(client, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "internal_api_key", INTERNAL_KEY)

    assert "reset_token" not in _forgot(client, email="nobody@example.com", key=INTERNAL_KEY).json()


# --- checking a reset link before showing the form ------------------------------------

def _token_for(client, monkeypatch, email="val@example.com"):
    from app.core.config import settings
    monkeypatch.setattr(settings, "internal_api_key", INTERNAL_KEY)
    _signup(client, email=email)
    return _forgot(client, email=email, key=INTERNAL_KEY).json()["reset_token"]


def _is_valid(client, token):
    return client.get("/auth/reset-password/validate", params={"token": token}).json()["valid"]


def test_a_fresh_reset_token_is_valid(client, monkeypatch):
    assert _is_valid(client, _token_for(client, monkeypatch)) is True


def test_an_unknown_reset_token_is_invalid(client):
    assert _is_valid(client, "not-a-real-token") is False


def test_a_used_reset_token_is_invalid(client, monkeypatch):
    token = _token_for(client, monkeypatch)
    client.post("/auth/reset-password", json={"token": token, "new_password": "brandnew456"})

    assert _is_valid(client, token) is False


def test_an_expired_reset_token_is_invalid(client, db_session, monkeypatch):
    from datetime import datetime, timedelta, timezone
    from app.models import PasswordResetToken
    token = _token_for(client, monkeypatch)
    row = db_session.query(PasswordResetToken).filter(PasswordResetToken.token == token).first()
    row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db_session.commit()

    assert _is_valid(client, token) is False
