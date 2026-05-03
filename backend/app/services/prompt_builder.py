from __future__ import annotations

import logging

from app.models.schemas import ChatMessage

logger = logging.getLogger(__name__)

# ── Token budget knobs ────────────────────────────────────────────────────────
# Groq free tier: 12 000 TPM. We aim for ~8 000 input tokens (output is capped
# separately in llm.py via CHAT_MAX_TOKENS) so a single request stays well
# inside the per-minute window even with a follow-up close behind.
MAX_TOTAL_TOKENS = 8000
MAX_CHUNK_TOKENS = 400
MAX_HISTORY_MESSAGES = 4
MAX_HISTORY_CONTENT_CHARS = 500
# Reserve room for system prompt + question + sources index + output overhead.
RESERVED_TOKENS = 1500


def estimate_tokens(text: str) -> int:
    """Rough char-based token estimate. ~4 chars per token for English+code."""
    return len(text) // 4


def truncate_chunk_content(content: str, max_tokens: int = MAX_CHUNK_TOKENS) -> str:
    if estimate_tokens(content) <= max_tokens:
        return content
    return content[: max_tokens * 4] + "\n# ... [truncated]"


# ── Prompts ───────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are CodeRAG, a senior software engineer answering questions about a specific GitHub codebase using ONLY the provided code chunks.

REASONING PROCESS (do this internally before answering):
1. Identify what the user is really asking
2. Find direct evidence in the chunks
3. Trace relationships between chunks (which functions call which)
4. If insufficient evidence, say so

ANSWER FORMAT:
- Lead with the direct answer in 1-2 sentences. No preamble.
- Use rich markdown formatting to make answers scannable and attractive:
  - ## Bold section titles for major sections (e.g. ## How It Works, ## Key Parameters, ## Call Flow)
  - **Bold** for function names, class names, and important terms on first mention
  - Bullet lists for multiple related points
  - Numbered lists for sequential steps or call chains
  - Tables when comparing multiple items (parameters, return values, config options, class methods, etc.)
  - Code blocks for all code snippets
- Use inline citations [file_path:start_line-end_line] after EVERY factual claim
- For "how does X work" questions structure as: ## Overview → ## How It Works → ## Where It's Called

WHEN TO USE TABLES:
- Listing function parameters with types and descriptions
- Comparing multiple classes, methods, or modules
- Showing config keys with their defaults and purpose
- Summarizing return values or error conditions
- Any time 3+ items share the same set of attributes

CITATION RULES (CRITICAL — follow exactly):
- Every factual statement about code MUST have a citation
- Citations MUST exactly match the [file_path:start_line-end_line] from chunk headers
- NEVER invent line numbers — use ONLY the exact ranges shown in chunk headers
- Place citations inline immediately after the claim, not at the end
- If a claim has no chunk support, say "not visible in the provided code"

AVOID:
- Generic explanations that could apply to any codebase
- Speculation without chunk evidence ("probably", "likely")
- Restating the question
- Phrases like "the chunks show" or "according to the code" — state the fact and cite it
- Preambles like "Based on the provided code..."
- Walls of plain prose — always break up with headers, lists, or tables

WHEN CHUNKS ARE INSUFFICIENT:
Say: "The provided code doesn't show how X works. The relevant code might be in [suggest likely file based on what you see]."
Never fabricate information."""

QUERY_REWRITE_PROMPT = """You are a search query optimizer for a code repository assistant.

Your job: Rewrite a follow-up question as a precise, standalone search query that can find relevant code chunks.

Rules:
- Resolve ALL pronouns (it, this, that, they) using conversation history
- Include specific class/function names if mentioned in history
- Make the query as specific as possible — name the exact thing being asked about
- Output ONLY the rewritten query — no explanation, no quotes, no preamble
- If already standalone and specific, return unchanged
- Keep it under 20 words

Example:
History: user asked about HTTPBasicAuth, assistant explained it
Follow-up: "How does it attach headers?"
Output: How does HTTPBasicAuth attach Authorization headers to requests"""


# ── Chunk formatting (citation enforcement) ───────────────────────────────────

def format_chunk_for_prompt(chunk: dict) -> str:
    """Render a chunk with a hard-to-miss CITE THIS AS header.

    The duplicated `[file:start-end]` label and the explicit "CITE THIS AS"
    line are deliberate — they make the exact citation string syntactically
    obvious to the LLM and reduce hallucinated line numbers.
    """
    content = truncate_chunk_content(chunk.get("content", ""))
    file_path = chunk.get("file_path", "unknown")
    start_line = chunk.get("start_line", 0)
    end_line = chunk.get("end_line", 0)
    name = chunk.get("name", "unknown")
    chunk_type = chunk.get("chunk_type", "code")

    header = f"[{file_path}:{start_line}-{end_line}]"

    return (
        f"CHUNK {header} ({chunk_type}: {name})\n"
        f"CITE THIS AS: {header}\n"
        f"```\n{content}\n```"
    )


# ── Message builders ──────────────────────────────────────────────────────────

def _trim_history(history: list[ChatMessage]) -> list[dict]:
    trimmed: list[dict] = []
    for msg in history[-MAX_HISTORY_MESSAGES:]:
        content = msg.content or ""
        if len(content) > MAX_HISTORY_CONTENT_CHARS:
            content = content[:MAX_HISTORY_CONTENT_CHARS] + "… [truncated]"
        trimmed.append({"role": msg.role, "content": content})
    return trimmed


def build_rag_messages(
    question: str,
    chunks: list[dict],
    conversation_history: list[ChatMessage],
) -> list[dict]:
    """Assemble the message list for the RAG answer with a hard token budget."""
    budget = MAX_TOTAL_TOKENS - RESERVED_TOKENS - estimate_tokens(question)

    # Greedily add chunks until budget is exhausted. Order is preserved so the
    # highest-ranked chunks are always included first.
    accepted: list[dict] = []
    sources_lines: list[str] = []
    used_tokens = 0
    for c in chunks:
        rendered = format_chunk_for_prompt(c)
        cost = estimate_tokens(rendered)
        if accepted and used_tokens + cost > budget:
            break
        accepted.append(c)
        sources_lines.append(
            f"- [{c['file_path']}:{c['start_line']}-{c['end_line']}]"
            f" ({c['chunk_type']} `{c['name']}`)"
        )
        used_tokens += cost

    sources_index = "\n".join(sources_lines) if sources_lines else "(none)"
    context_block = "\n\n---\n\n".join(format_chunk_for_prompt(c) for c in accepted)

    user_content = (
        f"## Available sources (cite ONLY from this list):\n{sources_index}\n\n"
        f"## Code chunks:\n\n{context_block}\n\n"
        f"## Question:\n{question}"
    )

    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(_trim_history(conversation_history))
    messages.append({"role": "user", "content": user_content})

    total = sum(estimate_tokens(m["content"]) for m in messages)
    logger.info(
        "RAG prompt built: %d/%d chunks, ~%d tokens (system+history+user)",
        len(accepted),
        len(chunks),
        total,
    )
    return messages


def build_rewrite_messages(
    question: str,
    conversation_history: list[ChatMessage],
) -> list[dict]:
    """Assemble the message list that asks Groq to rewrite a follow-up as a standalone query."""
    messages: list[dict] = [{"role": "system", "content": QUERY_REWRITE_PROMPT}]
    messages.extend(_trim_history(conversation_history))
    messages.append({"role": "user", "content": f"Rewrite this as a standalone question: {question}"})
    return messages
