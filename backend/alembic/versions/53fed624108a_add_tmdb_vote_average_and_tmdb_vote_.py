"""add tmdb_vote_average and tmdb_vote_count to movies

Revision ID: 53fed624108a
Revises: 64e83d8160c3
Create Date: 2026-10-05

"""
from alembic import op
import sqlalchemy as sa

revision = "53fed624108a"
down_revision = "64e83d8160c3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("movies", sa.Column("tmdb_vote_average", sa.Float(), nullable=True))
    op.add_column("movies", sa.Column("tmdb_vote_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("movies", "tmdb_vote_count")
    op.drop_column("movies", "tmdb_vote_average")
