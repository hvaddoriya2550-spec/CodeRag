"""Persists per-repo metadata to disk so it survives process restarts.

status_store is in-memory and loses github_url / file_count on every restart.
This module writes a small JSON file alongside each ChromaDB collection so that
_reconcile_status_store can restore the full RepoInfo on startup.
"""
from __future__ import annotations

import json
import logging
import os
import time

from app.config import settings

logger = logging.getLogger(__name__)


def _meta_path(repo_id: str) -> str:
    return os.path.join(settings.chroma_db_path, f"{repo_id}.meta.json")


def save_metadata(
    repo_id: str,
    github_url: str,
    branch: str,
    file_count: int,
    chunk_count: int,
) -> None:
    os.makedirs(settings.chroma_db_path, exist_ok=True)
    data = {
        "repo_id": repo_id,
        "github_url": github_url,
        "branch": branch,
        "file_count": file_count,
        "chunk_count": chunk_count,
        "ingested_at": time.time(),
    }
    path = _meta_path(repo_id)
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f)
    except OSError:
        logger.warning("Could not write metadata for '%s'", repo_id)


def load_metadata(repo_id: str) -> dict | None:
    path = _meta_path(repo_id)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        logger.warning("Could not read metadata for '%s'", repo_id)
        return None


def delete_metadata(repo_id: str) -> None:
    path = _meta_path(repo_id)
    try:
        os.remove(path)
    except FileNotFoundError:
        pass
    except OSError:
        logger.warning("Could not delete metadata for '%s'", repo_id)
