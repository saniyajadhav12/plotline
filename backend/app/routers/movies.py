import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Movie, CastCrew, WatchProvider, Rating
from app.schemas.movie import (
    MovieListResponse,
    MovieListItem,
    MovieDetailResponse,
    CastCrewResponse,
    WatchProviderResponse,
)

router = APIRouter(prefix="/movies", tags=["movies"])


@router.get("", response_model=MovieListResponse)
def list_movies(
    q: str | None = Query(default=None, description="Search by title"),
    genre: str | None = Query(default=None, description="Filter by genre"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Movie)

    if q:
        query = query.filter(Movie.title.ilike(f"%{q}%"))

    if genre:
        query = query.filter(Movie.genres.any(genre))

    total = query.count()
    results = (
        query.order_by(Movie.title)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return MovieListResponse(
        total=total,
        page=page,
        page_size=page_size,
        results=[MovieListItem.model_validate(m) for m in results],
    )


@router.get("/{movie_id}", response_model=MovieDetailResponse)
def get_movie_detail(
    movie_id: uuid.UUID,
    region: str = Query(default="US", description="Region code for watch providers, e.g. US, IN, GB"),
    db: Session = Depends(get_db),
):
    movie = db.query(Movie).filter(Movie.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movie not found")

    cast_crew = db.query(CastCrew).filter(CastCrew.movie_id == movie_id).all()
    cast = [CastCrewResponse.model_validate(c) for c in cast_crew if c.role == "cast"]
    director = [CastCrewResponse.model_validate(c) for c in cast_crew if c.role == "director"]

    providers = (
        db.query(WatchProvider)
        .filter(WatchProvider.movie_id == movie_id, WatchProvider.region == region)
        .all()
    )
    watch_providers = [WatchProviderResponse.model_validate(p) for p in providers]

    avg_rating = (
        db.query(func.avg(Rating.rating_value))
        .filter(Rating.movie_id == movie_id)
        .scalar()
    )

    return MovieDetailResponse(
        id=movie.id,
        title=movie.title,
        year=movie.year,
        genres=movie.genres,
        description=movie.description,
        poster_url=movie.poster_url,
        average_rating=round(float(avg_rating), 2) if avg_rating else None,
        cast=cast,
        director=director,
        watch_providers=watch_providers,
    )
