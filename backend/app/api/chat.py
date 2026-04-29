from __future__ import annotations

import asyncio
import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import ChatRequest
from app.services import vector_store
from app.services.retrieval import retrieve_chunks
from app.services.llm import rewrite_query, stream_answer
from app.services.prompt_builder import build_rag_messages

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


def sse_format(event_type: str, data: dict) -> str:
    return f"event: {event_type}\ndata: {json.dumps(data)}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest) -> StreamingResponse:
    if not vector_store.collection_exists(request.repo_id):
        raise HTTPException(status_code=404, detail=f"Repo not found: {request.repo_id}")

    async def event_stream():
        try:
            rewritten = await rewrite_query(request.question, request.conversation_history)

            chunks = await retrieve_chunks(rewritten, request.repo_id)
            if not chunks:
                yield sse_format("sources", {"chunks": []})
                yield sse_format("token", {"text": "I couldn't find any relevant code in this repository to answer your question."})
                yield sse_format("done", {})
                return

            sources_payload = [
                {
                    "chunk_id": c["chunk_id"],
                    "file_path": c["file_path"],
                    "name": c["name"],
                    "chunk_type": c["chunk_type"],
                    "start_line": c["start_line"],
                    "end_line": c["end_line"],
                }
                for c in chunks
            ]
            yield sse_format("sources", {"chunks": sources_payload})

            messages = build_rag_messages(request.question, chunks, request.conversation_history)

            async for token in stream_answer(messages):
                yield sse_format("token", {"text": token})

            yield sse_format("done", {})

        except Exception as e:
            logger.exception("Error in chat stream for repo '%s'", request.repo_id)
            yield sse_format("error", {"message": str(e)})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
