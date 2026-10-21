"""
Generates AI-powered, plain-English "why this was recommended"
explanations using Gemini, based on the hybrid scoring breakdown.

Gemini is treated as an optional enhancement, never a dependency:
  - fallback_explanation() is instant and always available.
  - try_gemini_explanation() returns None instead of raising or blocking.
  - A simple circuit breaker stops calling Gemini entirely after a quota
    (429) error, for as long as the API says to wait, so a used-up free
    tier costs zero time instead of 3 retries per movie.
"""
import re
import threading
import time
import uuid

from google import genai
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Movie, Rating, CastCrew

_client = None  # created on first use; stays None when no GEMINI_API_KEY is set


def _get_client():
    """The Gemini client, or None if no API key is configured. Created lazily, so a
    missing key never stops the app from starting: explanations simply fall back to
    the templated text."""
    global _client
    if _client is None and settings.gemini_api_key:
        _client = genai.Client(api_key=settings.gemini_api_key)
    return _client

GEMINI_MODEL = "gemini-3.8-flash"
DEFAULT_COOLDOWN_SECONDS = 60          # when a 429 doesn't say how long to wait
MAX_COOLDOWN_SECONDS = 24 * 60 * 60    # never back off longer than a day
OVERLOAD_COOLDOWN_SECONDS = 120        # after every retry fails (e.g. 503 high demand)

_circuit_lock = threading.Lock()
_gemini_disabled_until = 0.0
_RETRY_DELAY_RE = re.compile(r"retryDelay'?\s*:\s*'(\d+)s'")


def gemini_available() -> bool:
    """False when no API key is configured, or while the circuit breaker is open
    (recent quota error)."""
    return bool(settings.gemini_api_key) and time.time() >= _gemini_disabled_until


def _open_circuit(error_text: str) -> None:
    """Stop calling Gemini for as long as the 429 response asks."""
    match = _RETRY_DELAY_RE.search(error_text)
    cooldown = int(match.group(1)) if match else DEFAULT_COOLDOWN_SECONDS
    _disable_gemini_for(cooldown, "quota exhausted")


def _disable_gemini_for(seconds: int, reason: str) -> None:
    """Pause all Gemini calls for `seconds` (clamped to 1s..MAX_COOLDOWN_SECONDS)."""
    global _gemini_disabled_until
    seconds = max(1, min(seconds, MAX_COOLDOWN_SECONDS))
    with _circuit_lock:
        _gemini_disabled_until = max(_gemini_disabled_until, time.time() + seconds)
    print(f"  [Gemini] {reason}; skipping Gemini for {seconds}s (templated explanations meanwhile)")


def _is_quota_error(error_text: str) -> bool:
    return "429" in error_text or "RESOURCE_EXHAUSTED" in error_text


def _get_signal_context(user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session) -> str:
    """Builds a short factual context string describing WHY this movie scored well,
    for Gemini to turn into natural language. Keeps this factual/structured so the
    LLM doesn't have to guess at reasons."""
    parts = []

    if breakdown["cf_score"] > 0.3:
        top_rated = (
            db.query(Rating, Movie)
            .join(Movie, Rating.movie_id == Movie.id)
            .filter(Rating.user_id == user_id, Rating.rating_value >= 4)
            .order_by(Rating.rating_value.desc())
            .limit(3)
            .all()
        )
        similar_titles = [m.title for _, m in top_rated]
        if similar_titles:
            parts.append(f"The user highly rated similar movies: {', '.join(similar_titles)}.")

    if breakdown["content_score"] > 0.3:
        genres = ", ".join(movie.genres or [])
        director_rows = db.query(CastCrew).filter(CastCrew.movie_id == movie.id, CastCrew.role == "director").all()
        directors = ", ".join(d.person_name for d in director_rows)
        parts.append(f"This movie's genres are {genres}, directed by {directors}, matching the user's taste profile.")

    if breakdown["watchlist_boost"] > 0:
        parts.append("This movie is already on the user's watchlist.")

    return " ".join(parts) if parts else "This movie matches the user's general viewing patterns."


def fallback_explanation(user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session) -> str:
    """Instant templated explanation; no network calls."""
    context = _get_signal_context(user_id, movie, breakdown, db)
    return f"Recommended based on your viewing history and preferences. {context}"


def try_gemini_explanation(
    user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session, max_retries: int = 3
) -> str | None:
    """
    Returns a Gemini-written explanation, or None if Gemini is unavailable.
    - Circuit open (recent quota error): returns None immediately.
    - Quota error (429): opens the circuit and returns None without retrying.
    - Other errors (e.g. 503 high demand): retries with backoff, then None.
    """
    if not gemini_available():
        return None
    client = _get_client()
    if client is None:
        return None

    context = _get_signal_context(user_id, movie, breakdown, db)
    prompt = (
        f"You are writing a short, friendly 'Why this was recommended' explanation "
        f"for a movie recommendation app. Write ONE or TWO sentences, in plain "
        f"conversational English, explaining why '{movie.title}' was recommended to this user. "
        f"Base your explanation strictly on this factual context: {context} "
        f"Do not mention percentages, scores, or technical terms like 'collaborative filtering'. "
        f"Write as if speaking directly to the user."
    )

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
            text = (response.text or "").strip()
            return text or None
        except Exception as e:
            error_text = str(e)
            if _is_quota_error(error_text):
                _open_circuit(error_text)
                return None
            print(f"  [Gemini] attempt {attempt}/{max_retries} failed: {error_text[:200]}")
            if attempt < max_retries:
                time.sleep(2 * attempt)

    # Every retry failed (e.g. 503 "high demand"). Pause briefly so the rest of the
    # batch uses templated text instead of retrying each movie the same way.
    _disable_gemini_for(OVERLOAD_COOLDOWN_SECONDS, f"all {max_retries} attempts failed")
    return None


def generate_explanation(user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session, max_retries: int = 3) -> str:
    """Gemini explanation if available, otherwise the templated fallback.
    Kept for callers that want a single blocking call (e.g. batch scripts)."""
    return (
        try_gemini_explanation(user_id, movie, breakdown, db, max_retries=max_retries)
        or fallback_explanation(user_id, movie, breakdown, db)
    )
