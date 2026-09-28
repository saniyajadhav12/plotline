import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RateMovieRequest(BaseModel):
    rating_value: int = Field(ge=1, le=5)


class RatingResponse(BaseModel):
    id: uuid.UUID
    movie_id: uuid.UUID
    rating_value: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RatingWithMovieResponse(BaseModel):
    id: uuid.UUID
    rating_value: int
    created_at: datetime
    movie: "MovieListItem"

    model_config = {"from_attributes": True}


from app.schemas.movie import MovieListItem  # noqa: E402
RatingWithMovieResponse.model_rebuild()
