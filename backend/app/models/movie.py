import uuid

from sqlalchemy import Column, String, Integer, Text, DateTime, Float
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func

from app.core.database import Base


class Movie(Base):
    __tablename__ = "movies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tmdb_id = Column(Integer, unique=True, nullable=True)
    movielens_id = Column(Integer, unique=True, nullable=True)
    title = Column(String(500), nullable=False, index=True)
    year = Column(Integer, nullable=True)
    genres = Column(ARRAY(String), nullable=True)
    description = Column(Text, nullable=True)
    poster_url = Column(String(1000), nullable=True)
    popularity_score = Column(Float, nullable=True, index=True)
    tmdb_vote_average = Column(Float, nullable=True)
    tmdb_vote_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
