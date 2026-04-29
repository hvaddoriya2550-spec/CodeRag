import asyncio
import sys

from app.services.retrieval import retrieve_chunks
from app.services.llm import rewrite_query, stream_answer
from app.services.prompt_builder import build_rag_messages
from app.services.vector_store import collection_exists
from app.models.schemas import ChatMessage

REPO_ID = "psf_requests"


async def main() -> None:
    try:
        # ── Test 1: Verify repo is ingested ──────────────────────────────────
        print("Test 1 — Checking ingestion...")
        if not collection_exists(REPO_ID):
            print(f"❌ Repo '{REPO_ID}' not found in vector store. Run test_ingestion.py first.")
            sys.exit(1)
        print(f"✅ Repo '{REPO_ID}' is ingested\n")

        # ── Test 2: Retrieval only ────────────────────────────────────────────
        print("Test 2 — Retrieval:")
        query = "How does authentication work?"
        chunks = await retrieve_chunks(query, REPO_ID)
        print(f"Retrieved {len(chunks)} chunks:")
        for c in chunks:
            preview = c["content"][:60].replace("\n", " ")
            print(f"  {c['file_path']}  |  {c['name']}  |  {c['chunk_type']}  |  lines {c['start_line']}-{c['end_line']}")
            print(f"    {preview}...")
        print()

        # ── Test 3: Query rewriting ───────────────────────────────────────────
        print("Test 3 — Query rewriting:")
        history = [
            ChatMessage(role="user", content="How does the Session class work?"),
            ChatMessage(role="assistant", content="The Session class manages persistent connections..."),
        ]
        followup = "What methods does it have?"
        rewritten = await rewrite_query(followup, history)
        print(f"Original:  {followup}")
        print(f"Rewritten: {rewritten}")
        assert "Session" in rewritten, f"Expected 'Session' in rewritten query, got: {rewritten!r}"
        print("✅ Rewrite resolved the reference\n")

        # ── Test 4: Full streaming response ───────────────────────────────────
        print("Test 4 — Streaming answer:")
        stream_query = "How does HTTPBasicAuth work?"
        stream_chunks = await retrieve_chunks(stream_query, REPO_ID)
        messages = build_rag_messages(stream_query, stream_chunks, [])
        print("Streaming answer:\n")
        async for token in stream_answer(messages):
            print(token, end="", flush=True)
        print("\n\n✅ Streaming complete")

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        raise


asyncio.run(main())
