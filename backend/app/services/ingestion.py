import logging
import traceback

from app.services.github import clone_repo
from app.services.chunking import chunk_repository
from app.services.embedding import embed_texts, build_chunk_text
from app.services.vector_store import add_chunks, delete_collection
from app.services.status_store import set_status

logger = logging.getLogger(__name__)


def ingest_repository(github_url: str, repo_id: str) -> None:
    try:
        # Step 1 — Clone
        set_status(repo_id, status="cloning", progress=10,
                   message="Cloning repository", github_url=github_url)
        repo_path = clone_repo(github_url, repo_id)
        logger.info("Cloned to %s", repo_path)

        # Step 2 — Parse
        set_status(repo_id, status="parsing", progress=30,
                   message="Parsing code into chunks")
        result = chunk_repository(repo_path, repo_id)
        chunks = result["chunks"]
        if not chunks:
            raise ValueError(
                "No code chunks extracted — repo may be empty or unsupported"
            )
        set_status(repo_id, status="parsing", progress=50,
                   file_count=result["file_count"],
                   message=f"Parsed {len(chunks)} chunks from {result['file_count']} files")

        # Step 3 — Embed
        set_status(repo_id, status="embedding", progress=60,
                   message="Generating embeddings")
        texts = [build_chunk_text(c) for c in chunks]
        embeddings = embed_texts(texts)
        set_status(repo_id, status="embedding", progress=80,
                   message="Storing in vector database")

        # Step 4 — Store
        delete_collection(repo_id)  # wipe any previous ingestion before re-adding
        count = add_chunks(repo_id, chunks, embeddings)

        # Step 5 — Done
        set_status(repo_id, status="ready", progress=100,
                   chunk_count=count,
                   file_count=result["file_count"],
                   message=f"Ready — indexed {count} chunks from {result['file_count']} files")
        logger.info("Ingestion complete for %s", repo_id)

    except Exception as e:
        logger.error("Ingestion failed for %s:\n%s", repo_id, traceback.format_exc())
        set_status(repo_id, status="error", error=str(e), message="Ingestion failed")
        try:
            delete_collection(repo_id)
        except Exception:
            pass
