import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Movie, Rating, User
from app.routers.auth import get_current_user
from app.schemas.movie import MovieListItem
from app.schemas.rating import RateMovieRequest, RatingResponse, RatingWithMovieResponse
from app.services.recommendation_generator import save_recommendations_for_user, upgrade_explanations_background

router = APIRouter(tags=["ratings"])

MIN_RATINGS_FOR_RECOMMENDATIONS = 3


def _refresh_recommendations(user_id, db: Session, background_tasks: BackgroundTasks) -> None:
    """Saves fresh recommendations BEFORE the response is sent (fast: scoring plus
    templated explanations), so the next page load already has them. Only the
    slow Gemini explanation upgrade is queued as a background task. A failure
    here is logged but never fails the rating request itself."""
    try:
        pending = save_recommendations_for_user(user_id, db)
        print(f"[recommendations] Saved {len(pending)} recommendations for user {user_id} after rating")
    except Exception as e:
        db.rollback()
        print(f"[recommendations] Failed to generate recommendations for user {user_id}: {e}")
        return
    if pending:
        background_tasks.add_task(upgrade_explanations_background, user_id, pending)


@router.post("/movies/{movie_id}/ratings", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
def rate_movie(
    movie_id: uuid.UUID,
    payload: RateMovieRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    stmt = pg_insert(Rating).values(
        id=uuid.uuid4(),
        user_id=current_user.id,
        movie_id=movie_id,
        rating_value=payload.rating_value,
    ).on_conflict_do_update(
        index_elements=["user_id", "movie_id"],
        set_={"rating_value": payload.rating_value},
    ).returning(Rating)

    result = db.execute(stmt)
    db.commit()
    rating_obj = result.scalars().first()

    rating_count = db.query(Rating).filter(Rating.user_id == current_user.id).count()
    if rating_count >= MIN_RATINGS_FOR_RECOMMENDATIONS:
        _refresh_recommendations(current_user.id, db, background_tasks)

    return RatingResponse(
        id=rating_obj.id,
        movie_id=rating_obj.movie_id,
        rating_value=rating_obj.rating_value,
        created_at=rating_obj.created_at,
    )


@router.get("/users/me/ratings", response_model=list[RatingWithMovieResponse])
def get_my_ratings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ratings = (
        db.query(Rating)
        .filter(Rating.user_id == current_user.id)
        .order_by(Rating.created_at.desc())
        .all()
    )

    results = []
    for r in ratings:
        movie = db.query(Movie).filter(Movie.id == r.movie_id).first()
        results.append(RatingWithMovieResponse(
            id=r.id,
            rating_value=r.rating_value,
            created_at=r.created_at,
            movie=MovieListItem.model_validate(movie),
        ))
    return results
