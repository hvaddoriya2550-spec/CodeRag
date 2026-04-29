import time

from app.services.ingestion import ingest_repository
from app.services.status_store import get_status
from app.services.vector_store import search
from app.services.embedding import embed_query

GITHUB_URL = "https://github.com/psf/requests"
REPO_ID = "psf_requests"

TEST_QUERIES = [
    "How does authentication work?",
    "What does the session class do?",
    "How are errors handled?",
]

try:
    # Step 1 — Ingest
    print("Starting ingestion (this takes 30-90 seconds)...")
    t0 = time.time()
    ingest_repository(GITHUB_URL, REPO_ID)
    print(f"Ingestion complete in {time.time() - t0:.1f}s")

    # Step 2 — Check status
    status = get_status(REPO_ID)
    print("\n--- Status ---")
    for k, v in status.items():
        print(f"  {k}: {v}")
    assert status["status"] == "ready", f"Expected 'ready', got '{status['status']}': {status.get('error')}"

    # Step 3 — Semantic search
    print("\n--- Semantic Search ---")
    for query in TEST_QUERIES:
        print(f"\nQuery: {query!r}")
        query_embedding = embed_query(query)
        results = search(REPO_ID, query_embedding, top_k=3)
        if not results:
            print("  (no results)")
            continue
        for i, r in enumerate(results, 1):
            meta = r["metadata"]
            snippet = r["content"].replace("\n", " ")[:80]
            print(f"  [{i}] {meta['file_path']}  |  {meta['name']}  |  {meta['chunk_type']}"
                  f"  |  dist={r['distance']:.4f}")
            print(f"       {snippet!r}")

    print("\n✅ Week 3 ingestion test passed")

except Exception as e:
    print(f"\n❌ Failed: {e}")
    raise
