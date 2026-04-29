from __future__ import annotations

import logging
import os

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query

from app.config import settings
from app.models.schemas import IngestRequest, IngestResponse, RepoInfo, RepoStatus
from app.services.github import get_repo_id, validate_github_url
from app.services.ingestion import ingest_repository
from app.services import status_store, vector_store
from app.services.vector_store import collection_exists

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/repos", tags=["repos"])


@router.post("/ingest", response_model=IngestResponse, status_code=202)
async def ingest(request: IngestRequest, background_tasks: BackgroundTasks) -> IngestResponse:
    if not validate_github_url(request.github_url):
        raise HTTPException(status_code=422, detail="Invalid GitHub URL")

    repo_id = get_repo_id(request.github_url)
    existing = status_store.get_status(repo_id)
    if existing and existing["status"] in {"cloning", "parsing", "embedding"}:
        raise HTTPException(status_code=409, detail="Ingestion already in progress for this repo")

    status_store.set_status(repo_id, status="pending", progress=0,
                            message="Queued for ingestion", github_url=request.github_url)
    background_tasks.add_task(ingest_repository, request.github_url, repo_id)
    logger.info("Queued ingestion for %s", repo_id)
    return IngestResponse(repo_id=repo_id, status="pending", message="Ingestion started")


@router.get("/{repo_id}/status", response_model=RepoStatus)
async def get_status(repo_id: str) -> RepoStatus:
    entry = status_store.get_status(repo_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Repo not found")
    return RepoStatus(
        repo_id=entry["repo_id"],
        status=entry["status"],
        progress=entry["progress"],
        message=entry["message"],
        file_count=entry.get("file_count", 0),
        chunk_count=entry.get("chunk_count", 0),
        error=entry.get("error"),
    )


@router.get("", response_model=list[RepoInfo])
async def list_repos() -> list[RepoInfo]:
    statuses = status_store.list_all_statuses()
    return [
        RepoInfo(
            repo_id=s["repo_id"],
            name=s["repo_id"].replace("_", "/", 1),
            github_url=s.get("github_url", ""),
            status=s["status"],
            chunk_count=s.get("chunk_count", 0),
            created_at=str(s["created_at"]),
        )
        for s in statuses
    ]


@router.delete("/{repo_id}", status_code=204)
async def delete_repo(repo_id: str) -> None:
    entry = status_store.get_status(repo_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Repo not found")
    vector_store.delete_collection(repo_id)
    status_store.delete_status(repo_id)
    logger.info("Deleted repo %s", repo_id)


LANG_MAP: dict[str, str] = {
    ".py": "python", ".js": "javascript", ".ts": "typescript",
    ".jsx": "jsx", ".tsx": "tsx", ".md": "markdown", ".json": "json",
    ".yml": "yaml", ".yaml": "yaml", ".html": "html", ".css": "css",
}

MAX_VIEWER_SIZE = 1_000_000  # 1 MB


@router.get("/{repo_id}/file")
async def get_file(repo_id: str, path: str = Query(...)) -> dict:
    if not collection_exists(repo_id):
        raise HTTPException(status_code=404, detail="Repo not found")

    # os.path.abspath canonicalizes both paths (resolves all `..` segments) so
    # `startswith` reliably proves the requested file lives inside the repo root.
    repo_root = os.path.abspath(os.path.join(settings.repos_path, repo_id))
    requested = os.path.abspath(os.path.join(repo_root, path))
    if not requested.startswith(repo_root + os.sep) and requested != repo_root:
        raise HTTPException(status_code=400, detail="Invalid path")

    if not os.path.isfile(requested):
        raise HTTPException(status_code=404, detail="File not found")

    size = os.path.getsize(requested)
    if size > MAX_VIEWER_SIZE:
        raise HTTPException(status_code=413, detail="File too large to display")

    with open(requested, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    ext = os.path.splitext(path)[1].lower()
    language = LANG_MAP.get(ext, "text")

    return {
        "path": path,
        "content": content,
        "language": language,
        "size": size,
        "line_count": content.count("\n") + 1,
    }
