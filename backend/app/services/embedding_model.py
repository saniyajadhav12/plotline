"""
Lazily loads and caches the local sentence-transformers embedding
model in memory, so it's loaded once per server process rather than
on every request.

Forced onto CPU rather than Apple's Metal (MPS) GPU backend: for
single short-query inference, CPU is already fast enough that GPU
acceleration isn't needed, and it avoids a known PyTorch/MPS crash
class on Apple Silicon (AGXG14GFamilyCommandBuffer assertion
failures) that can corrupt the process's GPU command queue and hang
subsequent requests.
"""
from sentence_transformers import SentenceTransformer

_model = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-mpnet-base-v2", device="cpu")
    return _model
