from __future__ import annotations

import threading
import time

_status_store: dict[str, dict] = {}
_lock = threading.Lock()

VALID_STATUSES = {"pending", "cloning", "parsing", "embedding", "ready", "error"}


def set_status(
    repo_id: str,
    status: str,
    progress: int = 0,
    message: str = "",
    file_count: int = 0,
    chunk_count: int = 0,
    error: str | None = None,
    github_url: str | None = None,
) -> None:
    if status not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Must be one of {VALID_STATUSES}")
    now = time.time()
    with _lock:
        if repo_id not in _status_store:
            _status_store[repo_id] = {"repo_id": repo_id, "created_at": now}
        entry = _status_store[repo_id]
        entry["status"] = status
        entry["progress"] = progress
        entry["message"] = message
        entry["file_count"] = file_count
        entry["chunk_count"] = chunk_count
        entry["error"] = error
        entry["updated_at"] = now
        if github_url is not None:
            entry["github_url"] = github_url


def get_status(repo_id: str) -> dict | None:
    with _lock:
        entry = _status_store.get(repo_id)
        return dict(entry) if entry is not None else None


def list_all_statuses() -> list[dict]:
    with _lock:
        return sorted(
            (dict(e) for e in _status_store.values()),
            key=lambda e: e["created_at"],
            reverse=True,
        )


def delete_status(repo_id: str) -> bool:
    with _lock:
        return _status_store.pop(repo_id, None) is not None
