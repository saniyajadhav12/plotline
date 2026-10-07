import uuid

from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    region_preference = Column(String(10), nullable=False, default="US")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
