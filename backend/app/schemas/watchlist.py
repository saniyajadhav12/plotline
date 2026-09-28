import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.movie import MovieListItem


class WatchlistItemResponse(BaseModel):
    id: uuid.UUID
    added_at: datetime
    movie: MovieListItem

    model_config = {"from_attributes": True}
