from app.utils.file_walker import walk_repo, read_file_safe
from app.services.parser import extract_chunks_from_file


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

        all_chunks.extend(chunks)

    return {
        "file_count": len(files),
        "chunk_count": len(all_chunks),
        "skipped_files": skipped,
        "chunks": all_chunks,
    }
