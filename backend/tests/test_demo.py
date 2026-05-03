import asyncio
import re
import sys
import time

from app.services.llm import rewrite_query, stream_answer
from app.services.retrieval import retrieve_chunks
from app.services.prompt_builder import build_rag_messages
from app.services.vector_store import collection_exists
from app.models.schemas import ChatMessage

REPO_ID = "psf_requests"
QUESTION = "How does HTTPBasicAuth class work and how is it implemented?"
HISTORY: list[ChatMessage] = []

SEP = "=" * 60


def section(title: str) -> None:
    print(f"\n{SEP}")
    print(f"  {title}")
    print(SEP)


async def main() -> None:
    try:
        if not collection_exists(REPO_ID):
            print(f"❌  Repo '{REPO_ID}' not found. Run test_ingestion.py first.")
            sys.exit(1)

        # ── SECTION 1: INPUT ─────────────────────────────────────────────────
        section("STAGE 1 — INPUT")
        print(f"Question  : {QUESTION}")
        print(f"Repo ID   : {REPO_ID}")
        print(f"History   : {HISTORY}  (first turn — no prior context)")

        # ── SECTION 2: QUERY REWRITING ───────────────────────────────────────
        section("STAGE 2 — QUERY REWRITING")
        t0 = time.time()
        rewritten = await rewrite_query(QUESTION, HISTORY)
        elapsed = time.time() - t0
        print(f"Original question : {QUESTION}")
        print(f"Rewritten query   : {rewritten}")
        print(f"(No history → returned unchanged)  [{elapsed:.2f}s]")

        # ── SECTION 3: RETRIEVAL ─────────────────────────────────────────────
        section("STAGE 3 — RETRIEVAL  (top 5 after reranking)")
        t0 = time.time()
        chunks = await retrieve_chunks(rewritten, REPO_ID)
        elapsed = time.time() - t0
        print(f"Retrieved {len(chunks)} chunks in {elapsed:.2f}s\n")

        for i, chunk in enumerate(chunks, 1):
            print(f"  Rank {i}")
            print(f"  File       : {chunk['file_path']}")
            print(f"  Name       : {chunk['name']}")
            print(f"  Type       : {chunk['chunk_type']}")
            print(f"  Lines      : {chunk['start_line']}-{chunk['end_line']}")
            preview = chunk["content"][:200].replace("\n", "\n             ")
            print(f"  Preview    : {preview}")
            if i < len(chunks):
                print(f"  {'-' * 50}")

        # ── SECTION 4: FINAL PROMPT SENT TO GROQ ────────────────────────────
        section("STAGE 4 — FINAL PROMPT SENT TO GROQ")
        messages = build_rag_messages(QUESTION, chunks, HISTORY)
        system_msg = messages[0]["content"]
        user_msg = messages[-1]["content"]
        total_chars = sum(len(m["content"]) for m in messages)

        print("[ System message ]")
        print(system_msg)
        print(f"\n[ User message ({len(user_msg)} chars) ]")
        print(user_msg)
        print(f"\nTotal prompt characters : {total_chars}")
        print(f"Total messages          : {len(messages)}")

        # ── SECTION 5: STREAMING ANSWER ──────────────────────────────────────
        section("STAGE 5 — STREAMING ANSWER FROM GROQ")
        print("Streaming response:\n")
        token_count = 0
        char_count = 0
        full_answer = []
        t0 = time.time()

        async for token in stream_answer(messages):
            print(token, end="", flush=True)
            token_count += 1
            char_count += len(token)
            full_answer.append(token)

        elapsed = time.time() - t0
        answer_text = "".join(full_answer)
        print(f"\n\nTotal tokens streamed : {token_count}")
        print(f"Total characters      : {char_count}")
        print(f"Time elapsed          : {elapsed:.2f}s")

        # ── SECTION 6: EXTRACTED CITATIONS ───────────────────────────────────
        section("STAGE 6 — EXTRACTED CITATIONS")
        citation_pattern = re.compile(r'\[([^:\]]+):(\d+)-(\d+)\]')
        matches = citation_pattern.findall(answer_text)

        if matches:
            print(f"Found {len(matches)} citation(s):\n")
            seen = set()
            for file_path, start, end in matches:
                key = (file_path, start, end)
                if key in seen:
                    continue
                seen.add(key)
                print(f"  [{file_path}:{start}-{end}]")
                print(f"    file={file_path}  start={start}  end={end}")
        else:
            print("⚠️  No citations found — LLM may not have followed the format.")
            print("    Check SYSTEM_PROMPT and the reminder line in build_rag_messages.")

        print(f"\n{SEP}")
        print("  ✅  Demo complete")
        print(SEP)

    except Exception as e:
        print(f"\n❌  Demo failed: {e}")
        raise


asyncio.run(main())
