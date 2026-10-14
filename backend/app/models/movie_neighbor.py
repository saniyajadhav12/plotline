from sqlalchemy import Column, String, ForeignKey, CheckConstraint, REAL
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class MovieNeighbor(Base):
    """
    Precomputed top-K similar movies, built offline by
    app/scripts/build_offline_artifacts.py.

    kind = 'cf'      -> similarity from user rating patterns (collaborative filtering)
    kind = 'content' -> similarity from movie metadata (content-based, TF-IDF)

    The primary key (movie_id, kind, neighbor_id) doubles as the index for the
    serving query: "neighbors of the movies this user rated, of this kind".
    """

    __tablename__ = "movie_neighbors"
    __table_args__ = (
        CheckConstraint("kind IN ('cf', 'content')", name="ck_movie_neighbors_kind"),
    )

    movie_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True)
    kind = Column(String(10), primary_key=True)
    neighbor_id = Column(UUID(as_uuid=True), ForeignKey("movies.id", ondelete="CASCADE"), primary_key=True)
    similarity = Column(REAL, nullable=False)
