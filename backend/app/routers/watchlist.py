import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Movie, Watchlist, User
from app.routers.auth import get_current_user
from app.schemas.movie import MovieListItem
from app.schemas.watchlist import WatchlistItemResponse

router = APIRouter(tags=["watchlist"])


@router.post("/movies/{movie_id}/watchlist", status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    movie_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    stmt = pg_insert(Watchlist).values(
        id=uuid.uuid4(),
        user_id=current_user.id,
        movie_id=movie_id,
    ).on_conflict_do_nothing(
        index_elements=["user_id", "movie_id"],
    )
    db.execute(stmt)
    db.commit()

    return {"message": "Added to watchlist"}


@router.delete("/movies/{movie_id}/watchlist", status_code=status.HTTP_200_OK)
def remove_from_watchlist(
    movie_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deleted = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id, Watchlist.movie_id == movie_id)
        .delete()
    )
    db.commit()

    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not in watchlist")

    return {"message": "Removed from watchlist"}


@router.get("/users/me/watchlist", response_model=list[WatchlistItemResponse])
def get_my_watchlist(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.added_at.desc())
        .all()
    )

    results = []
    for item in items:
        movie = db.query(Movie).filter(Movie.id == item.movie_id).first()
        results.append(WatchlistItemResponse(
            id=item.id,
            added_at=item.added_at,
            movie=MovieListItem.model_validate(movie),
        ))
    return results
