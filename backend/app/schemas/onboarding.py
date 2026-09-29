import uuid

from pydantic import BaseModel


class OnboardingRequest(BaseModel):
    selected_genres: list[str]
    selected_movie_ids: list[uuid.UUID]


class OnboardingResponse(BaseModel):
    selected_genres: list[str] | None
    selected_movie_ids: list[uuid.UUID] | None

    model_config = {"from_attributes": True}
