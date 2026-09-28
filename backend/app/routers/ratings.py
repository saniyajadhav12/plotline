import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Movie, Rating, User
from app.routers.auth import get_current_user
from app.schemas.movie import MovieListItem
from app.schemas.rating import RateMovieRequest, RatingResponse, RatingWithMovieResponse

router = APIRouter(tags=["ratings"])


@router.post("/movies/{movie_id}/ratings", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
def rate_movie(
    movie_id: uuid.UUID,
    payload: RateMovieRequest,
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
