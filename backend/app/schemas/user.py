from pydantic import BaseModel, Field


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class ChangeRegionRequest(BaseModel):
    region_preference: str = Field(min_length=2, max_length=10)
