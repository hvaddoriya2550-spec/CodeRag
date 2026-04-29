from __future__ import annotations

import logging
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIM = 384

_model: SentenceTransformer | None = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading embedding model...")
        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
        logger.info("Model loaded")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a batch of texts, returning one 384-dim vector per text."""
    if not texts:
        return []
    model = get_embedding_model()
    vectors = model.encode(texts, batch_size=32, show_progress_bar=False, convert_to_numpy=True)
    logger.info("Embedded %d texts", len(texts))
    return vectors.tolist()


def embed_query(query: str) -> list[float]:
    """Embed a single query string."""
    return embed_texts([query])[0]


def build_chunk_text(chunk: dict) -> str:
    """Construct embedding input from a chunk, adding path/name context."""
    return (
        f"File: {chunk['file_path']}\n"
        f"Name: {chunk['name']}\n"
        f"Type: {chunk['chunk_type']}\n\n"
        f"{chunk['content']}"
    )
