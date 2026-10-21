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


# --- overload handling (fake client, no network, no real waiting) -----------------

from types import SimpleNamespace  # noqa: E402
import time  # noqa: E402


def _fake_client(responses):
    """generate_content returns/raises each item of `responses` in turn; records call count."""
    calls = {"n": 0}

    def generate_content(model, contents):
        item = responses[min(calls["n"], len(responses) - 1)]
        calls["n"] += 1
        if isinstance(item, Exception):
            raise item
        return SimpleNamespace(text=item)

    return SimpleNamespace(models=SimpleNamespace(generate_content=generate_content)), calls


def _setup_gemini(monkeypatch, client):
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")
    monkeypatch.setattr(eg, "_gemini_disabled_until", 0.0)
    monkeypatch.setattr(eg, "_get_client", lambda: client)
    monkeypatch.setattr(eg, "_get_signal_context", lambda *args: "context")
    monkeypatch.setattr(eg.time, "sleep", lambda seconds: None)


def test_every_retry_failing_pauses_gemini_briefly(monkeypatch):
    client, calls = _fake_client([Exception("503 UNAVAILABLE: high demand")])
    _setup_gemini(monkeypatch, client)

    result = eg.try_gemini_explanation(None, SimpleNamespace(title="Movie"), {}, None, max_retries=3)

    assert result is None
    assert calls["n"] == 3
    assert eg.gemini_available() is False
    remaining = eg._gemini_disabled_until - time.time()
    assert eg.OVERLOAD_COOLDOWN_SECONDS - 5 < remaining <= eg.OVERLOAD_COOLDOWN_SECONDS


def test_a_failure_then_success_returns_the_text_and_does_not_pause(monkeypatch):
    client, calls = _fake_client([Exception("503 UNAVAILABLE"), "Because you loved Inception."])
    _setup_gemini(monkeypatch, client)

    result = eg.try_gemini_explanation(None, SimpleNamespace(title="Movie"), {}, None, max_retries=3)

    assert result == "Because you loved Inception."
    assert calls["n"] == 2
    assert eg.gemini_available() is True
