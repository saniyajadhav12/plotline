"""resize embedding to 768 dims for mpnet model

Revision ID: 9eff316e37db
Revises: 344e275a61dc
Create Date: 2026-10-07

"""
from alembic import op

revision = "9eff316e37db"
down_revision = "344e275a61dc"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DROP INDEX IF EXISTS movies_embedding_idx")
    op.execute("ALTER TABLE movies ALTER COLUMN embedding TYPE vector(768) USING NULL")
    op.execute(
        "CREATE INDEX movies_embedding_idx ON movies "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS movies_embedding_idx")
    op.execute("ALTER TABLE movies ALTER COLUMN embedding TYPE vector(384) USING NULL")
    op.execute(
        "CREATE INDEX movies_embedding_idx ON movies "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
    )
