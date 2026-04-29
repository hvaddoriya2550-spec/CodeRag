"""
Standalone smoke test for the file-walking, parsing, and chunking pipeline.
Run from coderag/backend/ with:  python -m tests.test_parser
"""

import sys
import traceback

from app.services.github import validate_github_url, get_repo_id, clone_repo
from app.services.chunking import chunk_repository

# ── Test 1: URL validation ────────────────────────────────────────────────────

print("\n=== Test 1: URL Validation ===")

cases = [
    ("https://github.com/tiangolo/fastapi", True),
    ("https://github.com/psf/requests.git", True),
    ("https://google.com",                  False),
    ("not a url",                           False),
]

all_passed = True
for url, expected in cases:
    result = validate_github_url(url)
    ok = result == expected
    all_passed = all_passed and ok
    label = "PASS" if ok else "FAIL"
    print(f"  [{label}] {url!r}  →  valid={result}  (expected {expected})")

# ── Test 2: Clone and parse ───────────────────────────────────────────────────

print("\n=== Test 2: Clone and Parse ===")

TEST_URL = "https://github.com/psf/requests"

try:
    repo_id = get_repo_id(TEST_URL)
    print(f"  repo_id: {repo_id}")

    print("  Cloning repo...")
    repo_path = clone_repo(TEST_URL, repo_id)
    print(f"  Cloned to: {repo_path}")

    print("  Parsing and chunking...")
    result = chunk_repository(repo_path, repo_id)

    print(f"\n  Stats:")
    print(f"    files found : {result['file_count']}")
    print(f"    chunks made : {result['chunk_count']}")
    print(f"    files skipped: {result['skipped_files']}")

    print(f"\n  First 3 chunks:")
    for chunk in result["chunks"][:3]:
        print(f"\n    chunk_id   : {chunk['chunk_id']}")
        print(f"    file_path  : {chunk['file_path']}")
        print(f"    chunk_type : {chunk['chunk_type']}")
        print(f"    name       : {chunk['name']}")
        print(f"    lines      : {chunk['start_line']}–{chunk['end_line']}")
        print(f"    content    : {chunk['content'][:100]!r}")

    print("\n✅ Parser test complete")

except Exception as e:
    print(f"\n❌ Parser test failed: {e}")
    traceback.print_exc()
    sys.exit(1)
