from __future__ import annotations

import logging
from typing import AsyncGenerator

from groq import AsyncGroq

from app.config import settings

logger = logging.getLogger(__name__)

CHAT_MODEL = "llama-3.3-70b-versatile"
REWRITE_MODEL = "llama-3.1-8b-instant"  # cheaper/faster for the rewrite-only step
REWRITE_MAX_TOKENS = 150
CHAT_MAX_TOKENS = 1024
TEMPERATURE = 0.2

_client: AsyncGroq | None = None


def get_client() -> AsyncGroq:
    global _client
    if _client is None:
        _client = AsyncGroq(api_key=settings.groq_api_key)
    return _client


async def rewrite_query(question: str, conversation_history: list) -> str:
    """Rewrite a follow-up question into a standalone search query."""
    from app.services.prompt_builder import build_rewrite_messages

    if not conversation_history:
        return question

    messages = build_rewrite_messages(question, conversation_history)
    response = await get_client().chat.completions.create(
        model=REWRITE_MODEL,
        messages=messages,
        max_tokens=REWRITE_MAX_TOKENS,
        temperature=0.0,
        stream=False,
    )

    rewritten = (response.choices[0].message.content or "").strip().strip('"\'')

    if not rewritten or len(rewritten) > 500:
        return question

    logger.info("Rewrote: %s → %s", question, rewritten)
    return rewritten


async def stream_answer(messages: list[dict]) -> AsyncGenerator[str, None]:
    """Stream answer tokens from Groq, yielding one token string at a time."""
    logger.info("Starting stream for %d-message conversation", len(messages))
    try:
        stream = await get_client().chat.completions.create(
            model=CHAT_MODEL,
            messages=messages,
            max_tokens=CHAT_MAX_TOKENS,
            temperature=TEMPERATURE,
            stream=True,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token
        logger.info("Stream complete")
    except Exception as e:
        logger.exception("Groq stream failed")
        yield f"\n\n[Error: {str(e)}]"
