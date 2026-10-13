"""add embedding column to movies

Revision ID: 344e275a61dc
Revises: 991c5cb6fcb8
Create Date: 2026-10-07

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision = "344e275a61dc"
down_revision = "991c5cb6fcb8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column("movies", sa.Column("embedding", Vector(384), nullable=True))


def downgrade() -> None:
    op.drop_column("movies", "embedding")
