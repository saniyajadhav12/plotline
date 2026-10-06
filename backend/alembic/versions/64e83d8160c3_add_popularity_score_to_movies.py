"""add popularity_score to movies

Revision ID: 64e83d8160c3
Revises: a7c0a9e5b810
Create Date: 2026-10-05

"""
from alembic import op
import sqlalchemy as sa

revision = "64e83d8160c3"
down_revision = "a7c0a9e5b810"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("movies", sa.Column("popularity_score", sa.Float(), nullable=True))
    op.create_index("ix_movies_popularity_score", "movies", ["popularity_score"])


def downgrade() -> None:
    op.drop_index("ix_movies_popularity_score", table_name="movies")
    op.drop_column("movies", "popularity_score")
