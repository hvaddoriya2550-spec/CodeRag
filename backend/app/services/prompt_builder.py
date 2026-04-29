from __future__ import annotations

from app.models.schemas import ChatMessage

SYSTEM_PROMPT = """\
You are CodeRAG, an expert assistant that answers questions about code repositories.

Rules you must follow:
- Use ONLY the provided code chunks as your source of truth.
- If the answer is not present in the chunks, say so honestly — do not invent or infer code that isn't shown.
- Always cite sources using this exact format: [file_path:start_line-end_line]
  Example: [src/auth.py:42-67]
- Place citations inline immediately after each claim they support.
- Use Markdown for formatting: fenced code blocks, bullet lists, and headers where appropriate.
- Be concise but thorough — explain the *why* behind the code, not just the *what*.\
"""

QUERY_REWRITE_PROMPT = """\
You are a search query rewriter for a code question-answering system.

Given a conversation history and a follow-up question, rewrite the follow-up question \
as a fully self-contained search query that can be understood without any prior context.

Rules:
- Resolve all pronouns and references ("it", "that function", "the class above") using the conversation history.
- Output ONLY the rewritten question — no preamble, no quotes, no explanation.
- If the question is already standalone and unambiguous, return it unchanged.\
"""


def format_chunk_for_prompt(chunk: dict) -> str:
    """Render a single reranked chunk as a labelled block for the prompt."""
    meta = chunk.get("metadata", {})
    file_path = meta.get("file_path", "unknown")
    start_line = meta.get("start_line", "?")
    end_line = meta.get("end_line", "?")
    name = meta.get("name", "")
    chunk_type = meta.get("chunk_type", "")

    label = f"[{file_path}:{start_line}-{end_line}]"
    if name:
        label += f" ({chunk_type} {name})"

    indented = "\n".join(f" {line}" for line in chunk["content"].splitlines())
    return f"{label}\n{indented}"


def build_rag_messages(
    question: str,
    chunks: list[dict],
    conversation_history: list[ChatMessage],
) -> list[dict]:
    """Assemble the full message list to send to Groq for the RAG answer."""
    context_block = "\n\n---\n\n".join(format_chunk_for_prompt(c) for c in chunks)

    user_content = (
        f"## Retrieved code chunks:\n\n"
        f"{context_block}"
        f"\n\n## Question:\n"
        f"{question}\n\n"
        f"Answer using only the chunks above. Cite every claim with [file:start-end]."
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in conversation_history[-6:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": user_content})
    return messages


def build_rewrite_messages(
    question: str,
    conversation_history: list[ChatMessage],
) -> list[dict]:
    """Assemble the message list that asks Groq to rewrite a follow-up as a standalone query."""
    messages: list[dict] = [{"role": "system", "content": QUERY_REWRITE_PROMPT}]
    for msg in conversation_history[-4:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": f"Rewrite this as a standalone question: {question}"})
    return messages
