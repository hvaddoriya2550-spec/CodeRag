from __future__ import annotations

import logging
from sentence_transformers import CrossEncoder

logger = logging.getLogger(__name__)

RERANKER_MODEL_NAME = "BAAI/bge-reranker-base"
RERANK_TOP_K = 5

_model: CrossEncoder | None = None


def get_reranker_model() -> CrossEncoder:
    global _model
    if _model is None:
        logger.info("Loading reranker model...")
        _model = CrossEncoder(RERANKER_MODEL_NAME)
        logger.info("Reranker loaded")
    return _model


def rerank(
    query: str,
    candidates: list[dict],
    top_k: int = RERANK_TOP_K,
) -> list[dict]:
    """Score (query, chunk) pairs with a cross-encoder and return the top_k."""
    if not candidates:
        return []

    if len(candidates) <= top_k:
        return sorted(candidates, key=lambda c: c["distance"])

    model = get_reranker_model()
    pairs = [[query, c["content"]] for c in candidates]
    scores = model.predict(pairs)

    ranked = [
        {**c, "rerank_score": float(score)}
        for c, score in zip(candidates, scores)
    ]
    ranked.sort(key=lambda c: c["rerank_score"], reverse=True)

    logger.info("Reranked %d candidates → top %d", len(candidates), top_k)
    return ranked[:top_k]
