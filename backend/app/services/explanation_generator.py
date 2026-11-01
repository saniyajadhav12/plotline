"""
Generates AI-powered, plain-English "why this was recommended"
explanations using Gemini, based on the hybrid scoring breakdown.

Gemini is treated as an optional enhancement, never a dependency:
  - fallback_explanation() is instant and always available.
  - try_gemini_explanation() returns None instead of raising or blocking.
  - A simple circuit breaker stops calling Gemini entirely after a quota
    (429) error, for as long as the API says to wait, so a used-up free
    tier costs zero time instead of 3 retries per movie.
  - Every request has a timeout (GEMINI_TIMEOUT_SECONDS). A request that gets no
    answer in time pauses Gemini briefly instead of hanging the background job.
"""
import hashlib
import re
import threading
import time
import uuid
from dataclasses import dataclass

import requests
from google import genai
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import CastCrew, Movie, MovieNeighbor, OnboardingPreference, Rating

_client = None  # created on first use; stays None when no GEMINI_API_KEY is set


def _get_client():
    """The Gemini client, or None if no API key is configured. Created lazily, so a
    missing key never stops the app from starting: explanations simply fall back to
    the templated text."""
    global _client
    if _client is None and settings.gemini_api_key:
        _client = genai.Client(
            api_key=settings.gemini_api_key,
            http_options={"timeout": GEMINI_TIMEOUT_SECONDS * 1000},  # milliseconds
        )
    return _client

GEMINI_MODEL = "gemini-3.8-flash"
DEFAULT_COOLDOWN_SECONDS = 60          # when a 429 doesn't say how long to wait
MAX_COOLDOWN_SECONDS = 24 * 60 * 60    # never back off longer than a day
OVERLOAD_COOLDOWN_SECONDS = 120        # after every retry fails (e.g. 503 high demand)
GEMINI_TIMEOUT_SECONDS = 45           # a short reply measured ~18s; leaves headroom
PROMPT_SUMMARY_CHARS = 600            # plot summary length sent to Gemini
LINK_SIMILARITY_SLACK = 0.15          # links this close to the strongest count as equally strong

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


def _join(items: list[str]) -> str:
    """'A', 'A and B', 'A, B and C'."""
    items = [i for i in items if i]
    if len(items) <= 1:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def _variant(movie: Movie, slot: str, options: list[str]) -> str:
    """One phrasing per movie and slot: varied across movies, but stable for a given
    movie, so its explanation doesn't change between page loads."""
    digest = hashlib.sha256(f"{movie.id}:{slot}".encode()).digest()
    return options[digest[0] % len(options)]


@dataclass
class _Signals:
    """Facts about WHY a movie was recommended, collected once and worded two ways:
    third person for the Gemini prompt, second person for the visible fallback."""
    link: tuple[str, str] | None                  # (a movie the user rated 4-5, "cf" or "content")
    director_link: tuple[str, str, float] | None  # (director, their other movie, user's rating)
    directors: list[str]
    movie_genres: list[str]
    picked_genres: list[str]                      # this movie's genres the user picked in onboarding
    content_strong: bool
    on_watchlist: bool


def _collect_signals(user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session) -> _Signals:
    content_strong = breakdown.get("content_score", 0) > 0.3

    # The loved movies this recommendation is actually linked to (and how). When several
    # are about equally strong reasons, rotate between them per movie, so explanations
    # don't all cite the same title.
    link_rows = (
        db.query(Movie.title, MovieNeighbor.kind, Rating.rating_value, MovieNeighbor.similarity)
        .select_from(MovieNeighbor)
        .join(Rating, Rating.movie_id == MovieNeighbor.movie_id)
        .join(Movie, Movie.id == MovieNeighbor.movie_id)
        .filter(
            MovieNeighbor.neighbor_id == movie.id,
            Rating.user_id == user_id,
            Rating.rating_value >= 4,
        )
        .order_by(Rating.rating_value.desc(), MovieNeighbor.similarity.desc())
        .all()
    )
    link = None
    if link_rows:
        best_rating, best_similarity = link_rows[0][2], link_rows[0][3]
        candidates, seen = [], set()
        for title, kind, rating, similarity in link_rows:
            if rating == best_rating and similarity >= best_similarity - LINK_SIMILARITY_SLACK and title not in seen:
                seen.add(title)
                candidates.append((title, kind))
        link = _variant(movie, "linked-movie", candidates)

    directors = [
        name
        for (name,) in db.query(CastCrew.person_name)
        .filter(CastCrew.movie_id == movie.id, CastCrew.role == "director")
        .all()
        if name
    ]

    director_link = None
    if directors:
        row = (
            db.query(CastCrew.person_name, Movie.title, Rating.rating_value)
            .join(Movie, Movie.id == CastCrew.movie_id)
            .join(Rating, Rating.movie_id == Movie.id)
            .filter(
                Rating.user_id == user_id,
                Rating.rating_value >= 4,
                CastCrew.role == "director",
                CastCrew.person_name.in_(directors),
                Movie.id != movie.id,
            )
            .order_by(Rating.rating_value.desc())
            .first()
        )
        if row:
            director_link = (row[0], row[1], float(row[2]))

    movie_genres = list(movie.genres or [])
    preference = db.query(OnboardingPreference).filter(OnboardingPreference.user_id == user_id).first()
    chosen = set(preference.selected_genres or []) if preference else set()
    picked_genres = [g for g in movie_genres if g in chosen]

    return _Signals(
        link=link,
        director_link=director_link,
        directors=directors,
        movie_genres=movie_genres,
        picked_genres=picked_genres,
        content_strong=content_strong,
        on_watchlist=breakdown.get("watchlist_boost", 0) > 0,
    )


def _get_signal_context(user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session) -> str:
    """The facts in third person, for the Gemini prompt (the model writes the final
    wording). Only states things that are true for this user and movie."""
    s = _collect_signals(user_id, movie, breakdown, db)
    parts = []
    if s.link:
        title, kind = s.link
        if kind == "cf":
            parts.append(f"People with similar taste loved it, including fans of {title}, which the user rated highly.")
        else:
            parts.append(f"It has a lot in common with {title}, which the user rated highly.")
    if s.director_link:
        director, other, rating = s.director_link
        parts.append(f"It is directed by {director}, who also directed {other}, which the user rated {rating:g}/5.")
    elif s.content_strong and s.directors:
        parts.append(f"It is directed by {_join(s.directors)}.")
    if s.picked_genres:
        parts.append(f"Its genres ({_join(s.picked_genres)}) are among the user's favorite genres.")
    elif s.content_strong and s.movie_genres:
        parts.append(f"Its genres ({_join(s.movie_genres)}) and themes are close to what the user usually watches.")
    if s.on_watchlist:
        parts.append("It is already on the user's watchlist.")
    return " ".join(parts) if parts else "It matches the user's general viewing patterns."


def _link_options(title: str, kind: str) -> list[str]:
    if kind == "cf":
        return [
            f"Because you loved {title}, this one's a natural next watch.",
            f"If {title} was your kind of movie, this one's worth a look.",
            f"People who loved {title}, like you, tend to love this one too.",
            f"Fans of {title} keep coming back to this one.",
        ]
    return [
        f"It has a lot in common with {title}, which you loved.",
        f"It shares a lot of {title}'s spirit, and you loved that one.",
        f"Think of it as a cousin to {title}, one of your favorites.",
        f"If you enjoyed {title}, this one should feel familiar in the best way.",
    ]


def _genre_options(genres: str) -> list[str]:
    return [
        f"It's {genres}, right in line with the genres you picked.",
        f"Another {genres} pick, from genres you said you enjoy.",
        f"A {genres} title, which matches what you told us you like.",
        f"It's firmly in {genres} territory, just your kind of thing.",
    ]


def _user_facing_text(s: _Signals, movie: Movie) -> str:
    """The same facts in second person, with several phrasings per fact and a varied
    order, so explanations don't all read alike. At most three sentences."""
    leads = []
    if s.link:
        leads.append(_variant(movie, "link", _link_options(*s.link)))
    if s.picked_genres:
        leads.append(_variant(movie, "genres", _genre_options(_join(s.picked_genres))))
    elif s.content_strong and not s.link:
        leads.append("Its style and themes are close to what you usually watch.")
    if len(leads) == 2 and _variant(movie, "order", ["link-first", "genres-first"]) == "genres-first":
        leads.reverse()

    sentences = leads
    if s.director_link:
        director, other, rating = s.director_link
        sentences.append(_variant(movie, "director", [
            f"It's from {director}, who also directed {other}, which you rated {rating:g}/5.",
            f"{director} directed it, the same filmmaker behind {other} ({rating:g}/5 from you).",
        ]))
    if s.on_watchlist:
        if sentences:
            sentences.append(_variant(movie, "watchlist", [
                "It's already on your watchlist, too.",
                "And it's been sitting on your watchlist.",
            ]))
        else:
            sentences.append("It's already on your watchlist.")
    if not sentences:
        sentences.append(_variant(movie, "general", [
            "It fits the overall pattern of what you enjoy.",
            "It lines up with what you've been watching and rating.",
        ]))
    return " ".join(sentences[:3])


def fallback_explanation(user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session) -> str:
    """Instant explanation built from real facts, no network calls. Shown until (or
    instead of) a Gemini-written one."""
    return _user_facing_text(_collect_signals(user_id, movie, breakdown, db), movie)


def try_gemini_explanation(
    user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session, max_retries: int = 3
) -> str | None:
    """
    Returns a Gemini-written explanation, or None if Gemini is unavailable.
    - Circuit open (recent quota error): returns None immediately.
    - Quota error (429): opens the circuit and returns None without retrying.
    - Other errors (e.g. 503 high demand): retries with backoff, then None.
    - Timeout (no answer within GEMINI_TIMEOUT_SECONDS): no retry, since each retry
      would wait the full timeout again. Pauses Gemini briefly, then None.
    """
    if not gemini_available():
        return None
    client = _get_client()
    if client is None:
        return None

    context = _get_signal_context(user_id, movie, breakdown, db)
    genres = ", ".join(getattr(movie, "genres", None) or []) or "not listed"
    summary = (getattr(movie, "description", None) or "").strip()
    if len(summary) > PROMPT_SUMMARY_CHARS:
        summary = summary[:PROMPT_SUMMARY_CHARS].rsplit(" ", 1)[0] + "…"
    year = getattr(movie, "year", None)
    title = f"{movie.title} ({year})" if year else movie.title
    prompt = (
        "You're writing the 'Why this was recommended' note in a movie app. "
        "Speak directly to the viewer as 'you'. Write two short sentences in a warm, "
        "natural voice that connect what this movie is about to why it fits their taste.\n"
        f"Movie: {title}\n"
        f"Genres: {genres}\n"
        f"Plot summary: {summary or 'not available'}\n"
        f"Why it was recommended: {context}\n"
        "Rules: don't invent anything beyond these facts; no spoilers beyond the summary; "
        "never mention scores, percentages, rating numbers or algorithms; "
        "don't start with 'Recommended'."
    )

    for attempt in range(1, max_retries + 1):
        try:
            response = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
            text = (response.text or "").strip()
            return text or None
        except requests.exceptions.Timeout:
            _disable_gemini_for(
                OVERLOAD_COOLDOWN_SECONDS, f"request timed out after {GEMINI_TIMEOUT_SECONDS}s"
            )
            return None
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
