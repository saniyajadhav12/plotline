import uuid

from pydantic import BaseModel


class CastCrewResponse(BaseModel):
    person_name: str
    role: str
    character_name: str | None = None

    model_config = {"from_attributes": True}


class WatchProviderResponse(BaseModel):
    provider_name: str
    provider_type: str

    model_config = {"from_attributes": True}


class MovieListItem(BaseModel):
    id: uuid.UUID
    title: str
    year: int | None
    genres: list[str] | None
    poster_url: str | None

    model_config = {"from_attributes": True}


class MovieListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[MovieListItem]


class MovieDetailResponse(BaseModel):
    id: uuid.UUID
    title: str
    year: int | None
    genres: list[str] | None
    description: str | None
    poster_url: str | None
    average_rating: float | None
    tmdb_rating: float | None
    tmdb_vote_count: int | None
    cast: list[CastCrewResponse]
    director: list[CastCrewResponse]
    watch_providers: list[WatchProviderResponse]

    model_config = {"from_attributes": True}
