import os
import re
import shutil

import git

from app.config import settings

_GITHUB_PATTERN = re.compile(
    r"^https?://github\.com/([a-zA-Z0-9_.-]+)/([a-zA-Z0-9_.-]+?)(?:\.git)?/?$"
)


def validate_github_url(url: str) -> bool:
    return bool(_GITHUB_PATTERN.match(url))


def get_repo_id(url: str) -> str:
    url = url.rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
    # Extract "owner/repo" from the URL and build a filesystem-safe identifier
    match = _GITHUB_PATTERN.match(url) or _GITHUB_PATTERN.match(url + "/")
    if not match:
        raise ValueError(f"Invalid GitHub URL: {url}")
    owner, repo = match.group(1), match.group(2)
    return f"{owner}_{repo}"


def get_repo_path(repo_id: str) -> str:
    return os.path.join(settings.repos_path, repo_id)


def clone_repo(url: str, repo_id: str) -> str:
    path = get_repo_path(repo_id)
    if os.path.exists(path):
        shutil.rmtree(path)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    try:
        git.Repo.clone_from(url, path)
    except git.GitCommandError as e:
        raise RuntimeError(f"Failed to clone {url}: {e}") from e
    return path


def repo_exists(repo_id: str) -> bool:
    return os.path.isdir(get_repo_path(repo_id))
