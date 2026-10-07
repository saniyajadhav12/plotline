"""add name to users

Revision ID: 991c5cb6fcb8
Revises: 53fed624108a
Create Date: 2026-10-06

"""
from alembic import op
import sqlalchemy as sa

revision = "991c5cb6fcb8"
down_revision = "53fed624108a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("name", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "name")
