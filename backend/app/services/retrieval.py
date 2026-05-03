from __future__ import annotations

import logging

from app.services.embedding import embed_query
from app.services.vector_store import search
from app.services.reranker import rerank

logger = logging.getLogger(__name__)

VECTOR_TOP_K = 15
RERANK_TOP_K = 5


def keyword_boost(query: str, candidates: list[dict]) -> list[dict]:
    """Boost candidates whose chunk name appears verbatim in the query.

    Pure vector search misses exact-name matches when a user asks about a
    specific function or class by name. We halve the distance (lower is
    better) for any candidate whose `metadata.name` substring-matches the
    query — surfaces it for the rerank stage.
    """
    query_lower = query.lower()
    boosted = 0
    for c in candidates:
        name = (c.get("metadata", {}).get("name") or "").lower()
        if name and len(name) > 2 and name in query_lower:
            c["distance"] = c.get("distance", 1.0) * 0.5
            boosted += 1
    if boosted:
        logger.info("Keyword-boosted %d/%d candidates", boosted, len(candidates))
    return candidates


def deduplicate_chunks(chunks: list[dict]) -> list[dict]:
    """Drop duplicate chunks sharing the same file_path + name (keep first)."""
    seen: set[str] = set()
    result: list[dict] = []
    for c in chunks:
        meta = c.get("metadata", {})
        key = f"{meta.get('file_path')}::{meta.get('name')}"
        if key not in seen:
            seen.add(key)
            result.append(c)
    return result


async def retrieve_chunks(
    query: str,
    repo_id: str,
    top_k: int = RERANK_TOP_K,
) -> list[dict]:
    """Embed → vector search → keyword boost → rerank → dedup → normalize."""
    logger.info("Retrieving for: %s", query[:80])

    query_embedding = embed_query(query)

    candidates = search(repo_id, query_embedding, top_k=VECTOR_TOP_K)
    if not candidates:
        logger.warning("No candidates returned from vector search for repo '%s'", repo_id)
        return []

    candidates = keyword_boost(query, candidates)
    reranked = rerank(query, candidates, top_k=top_k)
    deduped = deduplicate_chunks(reranked)

    chunks = []
    for chunk in deduped:
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

    logger.info("Retrieved %d final chunks (after dedup)", len(chunks))
    return chunks
