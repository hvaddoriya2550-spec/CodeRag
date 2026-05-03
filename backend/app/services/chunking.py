from app.utils.file_walker import walk_repo, read_file_safe
from app.services.parser import extract_chunks_from_file

# Hard cap on chunk content size at extraction time. Oversized chunks (e.g. a
# 4 000-char class) are truncated before embedding/storage so the index never
# holds anything that would single-handedly exceed the prompt token budget.
MAX_CHUNK_CHARS = 1600


def _truncate(content: str) -> str:
    if len(content) <= MAX_CHUNK_CHARS:
        return content
    return content[:MAX_CHUNK_CHARS] + "\n# ... [truncated]"


def chunk_repository(repo_path: str, repo_id: str) -> dict:
    files = walk_repo(repo_path)
    all_chunks: list[dict] = []
    skipped = 0

    for file_info in files:
        source = read_file_safe(file_info["path"])
        if source is None:
            skipped += 1
            continue

        chunks = extract_chunks_from_file(
            file_path=file_info["path"],
            relative_path=file_info["relative_path"],
            source_code=source,
        )

        for i, chunk in enumerate(chunks):
            chunk["chunk_id"] = f"{repo_id}:{file_info['relative_path']}:{i}"
            chunk["content"] = _truncate(chunk["content"])

        all_chunks.extend(chunks)

    return {
        "file_count": len(files),
        "chunk_count": len(all_chunks),
        "skipped_files": skipped,
        "chunks": all_chunks,
    }
