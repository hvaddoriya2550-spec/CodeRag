from typing import Optional

from pydantic import BaseModel, field_validator


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class IngestRequest(BaseModel):
    github_url: str
    branch: str = "main"

    @field_validator("github_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        if not v.startswith("https://github.com/"):
            raise ValueError("github_url must start with https://github.com/")
        return v


class IngestResponse(BaseModel):
    repo_id: str
    status: str
    message: str


class RepoStatus(BaseModel):
    repo_id: str
    status: str  # "pending" | "cloning" | "parsing" | "embedding" | "ready" | "error"
    progress: int  # 0-100
    message: str
    file_count: int = 0
    chunk_count: int = 0
    error: Optional[str] = None


class RepoInfo(BaseModel):
    repo_id: str
    name: str
    github_url: str
    status: str
    chunk_count: int
    created_at: str


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    question: str
    repo_id: str
    conversation_history: list[ChatMessage] = []


class CodeChunk(BaseModel):
    file_path: str
    start_line: int
    end_line: int
    content: str
    name: str
    chunk_type: str
