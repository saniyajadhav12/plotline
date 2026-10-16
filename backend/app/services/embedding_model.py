"""
Lazily loads and caches the local sentence-transformers embedding
model in memory, so it's loaded once per server process rather than
on every request.

The sentence_transformers import (which pulls in PyTorch) happens inside
get_embedding_model(), not at module import time. That keeps PyTorch out of
memory at startup, and lets the production image ship without it at all:
there, get_embedding_model() raises SemanticSearchUnavailable instead.

Forced onto CPU rather than Apple's Metal (MPS) GPU backend: for
single short-query inference, CPU is already fast enough that GPU
acceleration isn't needed, and it avoids a known PyTorch/MPS crash
class on Apple Silicon (AGXG14GFamilyCommandBuffer assertion
failures) that can corrupt the process's GPU command queue and hang
subsequent requests.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer


class SemanticSearchUnavailable(RuntimeError):
    """Raised when sentence-transformers isn't installed (e.g. the slim production image)."""


_model = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as e:
            raise SemanticSearchUnavailable(
                "Semantic search is not available on this server."
            ) from e
        _model = SentenceTransformer("all-mpnet-base-v2", device="cpu")
    return _model
