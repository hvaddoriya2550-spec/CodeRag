from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.models.schemas import IngestRequest, IngestResponse, RepoInfo, RepoStatus
from app.services.github import get_repo_id, validate_github_url
from app.services.ingestion import ingest_repository
from app.services import status_store, vector_store

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
