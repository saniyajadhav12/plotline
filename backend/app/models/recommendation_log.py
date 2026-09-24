import uuid

from sqlalchemy import Column, String, Text, Boolean, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class RecommendationLog(Base):
    __tablename__ = "recommendation_logs"
    __table_args__ = (
        CheckConstraint("method IN ('collaborative', 'content', 'hybrid')", name="ck_recommendation_logs_method"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    method = Column(String(20), nullable=False)
    explanation_text = Column(Text, nullable=True)
    is_cached = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
