from __future__ import annotations

import logging

from app.services.embedding import embed_query
from app.services.vector_store import search
from app.services.reranker import rerank

logger = logging.getLogger(__name__)

VECTOR_TOP_K = 15
RERANK_TOP_K = 5


async def retrieve_chunks(
    query: str,
    repo_id: str,
    top_k: int = RERANK_TOP_K,
) -> list[dict]:
    """Embed → vector search → rerank → normalize. Returns top_k flat chunk dicts."""
    logger.info("Retrieving for: %s", query[:80])

    query_embedding = embed_query(query)

    candidates = search(repo_id, query_embedding, top_k=VECTOR_TOP_K)
    if not candidates:
        logger.warning("No candidates returned from vector search for repo '%s'", repo_id)
        return []

    reranked = rerank(query, candidates, top_k=top_k)

    chunks = []
    for chunk in reranked:
        meta = chunk["metadata"]
        chunks.append(
            {
                "chunk_id": chunk["chunk_id"],
                "content": chunk["content"],
                "file_path": meta["file_path"],
                "name": meta["name"],
                "chunk_type": meta["chunk_type"],
                "start_line": int(meta["start_line"]),
                "end_line": int(meta["end_line"]),
            }
        )

    logger.info("Retrieved %d final chunks", len(chunks))
    return chunks
