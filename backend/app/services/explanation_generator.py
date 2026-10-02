"""
Generates AI-powered, plain-English "why this was recommended"
explanations using Gemini, based on the hybrid scoring breakdown.
"""
import time
import uuid

from google import genai
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Movie, Rating, CastCrew

_client = genai.Client(api_key=settings.gemini_api_key)


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


def generate_explanation(user_id: uuid.UUID, movie: Movie, breakdown: dict, db: Session, max_retries: int = 3) -> str:
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
            response = _client.models.generate_content(
                model="gemini-3.8-flash",
                contents=prompt,
            )
            return response.text.strip()
        except Exception as e:
            print(f"  [Gemini] attempt {attempt}/{max_retries} failed: {e}")
            if attempt < max_retries:
                time.sleep(2 * attempt)

    # All retries exhausted: fall back to a simple templated explanation
    # rather than failing the whole batch over one flaky API call.
    print("  [Gemini] all retries failed, using fallback explanation")
    return f"Recommended based on your viewing history and preferences. {context}"
