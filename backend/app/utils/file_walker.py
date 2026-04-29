import os
from typing import Optional

SUPPORTED_EXTENSIONS = {".py", ".js", ".ts", ".jsx", ".tsx"}

SKIP_DIRS = {
    "node_modules", ".git", "venv", ".venv", "__pycache__",
    "dist", "build", ".next", "coverage", ".pytest_cache",
    "eggs", ".eggs",
}

_MAX_FILE_BYTES = 500 * 1024  # 500 KB

_SKIP_FILENAMES = {"package-lock.json", "yarn.lock", "poetry.lock"}
_SKIP_SUFFIXES = (".min.js", ".min.css")


def should_skip_file(filepath: str) -> bool:
    name = os.path.basename(filepath)
    if name in _SKIP_FILENAMES:
        return True
    if name.endswith(_SKIP_SUFFIXES):
        return True
    try:
        if os.path.getsize(filepath) > _MAX_FILE_BYTES:
            return True
    except OSError:
        return True
    return False


def walk_repo(repo_path: str) -> list[dict]:
    results = []
    for dirpath, dirnames, filenames in os.walk(repo_path):
        # Prune SKIP_DIRS in-place so os.walk won't descend into them
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for filename in filenames:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue
            full_path = os.path.join(dirpath, filename)
            if should_skip_file(full_path):
                continue
            results.append({
                "path": full_path,
                "relative_path": os.path.relpath(full_path, repo_path),
                "extension": ext,
                "size_bytes": os.path.getsize(full_path),
            })
    return results


def read_file_safe(filepath: str) -> Optional[str]:
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except OSError:
        return None
