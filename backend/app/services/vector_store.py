from __future__ import annotations

import logging

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import settings

logger = logging.getLogger(__name__)

_client: chromadb.PersistentClient | None = None


def get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_db_path,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
    return _client


def get_or_create_collection(repo_id: str) -> chromadb.Collection:
    return get_client().get_or_create_collection(
        name=repo_id,
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(
    repo_id: str,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> int:
    assert len(chunks) == len(embeddings), (
        f"chunks ({len(chunks)}) and embeddings ({len(embeddings)}) length mismatch"
    )
    collection = get_or_create_collection(repo_id)
    collection.add(
        ids=[c["chunk_id"] for c in chunks],
        documents=[c["content"] for c in chunks],
        embeddings=embeddings,
        metadatas=[
            {
                "file_path": c["file_path"],
                "name": c["name"],
                "chunk_type": c["chunk_type"],
                "start_line": int(c["start_line"]),
                "end_line": int(c["end_line"]),
            }
            for c in chunks
        ],
    )
    logger.info("Added %d chunks to collection '%s'", len(chunks), repo_id)
    return len(chunks)


def search(
    repo_id: str,
    query_embedding: list[float],
    top_k: int = 15,
) -> list[dict]:
    try:
        collection = get_or_create_collection(repo_id)
        if collection.count() == 0:
            return []
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )
    except Exception:
        logger.exception("Search failed for repo '%s'", repo_id)
        return []

    hits = []
    for chunk_id, document, metadata, distance in zip(
        results["ids"][0],
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        hits.append(
            {
                "chunk_id": chunk_id,
                "content": document,
                "metadata": metadata,
                "distance": distance,
            }
        )
    return hits


def delete_collection(repo_id: str) -> bool:
    try:
        get_client().delete_collection(name=repo_id)
        logger.info("Deleted collection '%s'", repo_id)
        return True
    except Exception:
        logger.warning("Could not delete collection '%s'", repo_id)
        return False


def collection_exists(repo_id: str) -> bool:
    return any(c.name == repo_id for c in get_client().list_collections())


def get_collection_count(repo_id: str) -> int:
    try:
        return get_or_create_collection(repo_id).count()
    except Exception:
        return 0
