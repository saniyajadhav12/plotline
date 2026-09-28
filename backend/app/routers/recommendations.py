from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Movie, RecommendationLog, User
from app.routers.auth import get_current_user
from app.schemas.movie import MovieListItem
from app.schemas.recommendation import RecommendationResponse

router = APIRouter(tags=["recommendations"])


@router.get("/users/me/recommendations", response_model=list[RecommendationResponse])
def get_my_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = (
        db.query(RecommendationLog)
        .filter(RecommendationLog.user_id == current_user.id)
        .order_by(RecommendationLog.created_at.desc())
        .all()
    )

    results = []
    for log in logs:
        movie = db.query(Movie).filter(Movie.id == log.movie_id).first()
        if not movie:
            continue
        results.append(RecommendationResponse(
            id=log.id,
            method=log.method,
            explanation_text=log.explanation_text,
            created_at=log.created_at,
            movie=MovieListItem.model_validate(movie),
        ))
    return results
