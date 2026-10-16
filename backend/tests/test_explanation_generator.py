"""Gemini must stay optional: the app has to start and serve templated
explanations without an API key, and stop calling Gemini after a quota error.
(The first production deploy crashed at startup because the client was created
at import time with an empty key; CI always set a key, so nothing caught it.)"""
from app.core.config import settings
from app.services import explanation_generator as eg


def test_no_api_key_means_gemini_unavailable_and_no_client(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(eg, "_client", None)

    assert eg.gemini_available() is False
    assert eg._get_client() is None


def test_no_api_key_skips_gemini_without_touching_db_or_network(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "")
    monkeypatch.setattr(eg, "_client", None)

    # movie/db are None on purpose: the function must return before using them.
    assert eg.try_gemini_explanation(user_id=None, movie=None, breakdown={}, db=None) is None


def test_quota_error_opens_the_circuit_breaker(monkeypatch):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(eg, "_gemini_disabled_until", 0.0)
    assert eg.gemini_available() is True

    eg._open_circuit("429 RESOURCE_EXHAUSTED ... 'retryDelay': '30s'")

    assert eg.gemini_available() is False
