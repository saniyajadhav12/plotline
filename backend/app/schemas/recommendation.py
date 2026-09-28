import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.movie import MovieListItem


class RecommendationResponse(BaseModel):
    id: uuid.UUID
    method: str
    explanation_text: str | None
    created_at: datetime
    movie: MovieListItem

    model_config = {"from_attributes": True}
