import uuid

from sqlalchemy import Column, String, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class WatchProvider(Base):
    __tablename__ = "watch_providers"
    __table_args__ = (
        CheckConstraint("provider_type IN ('subscription', 'rent', 'buy')", name="ck_watch_providers_type"),
        UniqueConstraint("movie_id", "region", "provider_name", "provider_type", name="uq_watch_providers"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), nullable=False, index=True)
    region = Column(String(10), nullable=False, index=True)
    provider_name = Column(String(255), nullable=False)
    provider_type = Column(String(20), nullable=False)
