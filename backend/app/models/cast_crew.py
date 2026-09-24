import uuid

from sqlalchemy import Column, String, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class CastCrew(Base):
    __tablename__ = "cast_crew"
    __table_args__ = (
        CheckConstraint("role IN ('cast', 'director')", name="ck_cast_crew_role"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    person_name = Column(String(255), nullable=False, index=True)
    role = Column(String(20), nullable=False)
    character_name = Column(String(255), nullable=True)
