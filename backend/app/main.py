import logging

import uvicorn
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.schemas import HealthResponse
from app.api import repos, chat
from app.services import status_store, vector_store

logger = logging.getLogger(__name__)


def _reconcile_status_store() -> None:
    """Seed status_store from ChromaDB collections that survived a restart.

    status_store is in-memory and resets on every process restart, but
    ChromaDB persists to disk. Without this, all previously-indexed repos
    vanish from /api/repos after a restart even though their vectors are intact.
    """
    collections = vector_store.get_client().list_collections()
    for col in collections:
        if status_store.get_status(col.name) is not None:
            continue  # already in store (fresh ingestion this session)
        chunk_count = vector_store.get_collection_count(col.name)
        status_store.set_status(
            repo_id=col.name,
            status="ready",
            progress=100,
            message="Restored from persistent storage",
            chunk_count=chunk_count,
        )
        logger.info("Restored repo '%s' (%d chunks) from ChromaDB", col.name, chunk_count)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _reconcile_status_store()
    yield


app = FastAPI(
    title="CodeRAG API",
    description="AI-powered code question answering",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repos.router)
app.include_router(chat.router)


@app.get("/")
async def root():
    return {"message": "Welcome to CodeRAG API", "docs": "/docs"}


@app.get("/api/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        environment=settings.environment,
    )


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
