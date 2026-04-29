# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

---

## Quick Reference

| Task | Command (run from `coderag/backend/`) |
|------|----------------------------------------|
| Start API server | `venv/bin/python -m app.main` |
| Run parser smoke test | `venv/bin/python -m tests.test_parser` |
| Run Groq smoke test | `venv/bin/python -m tests.test_groq` |
| Install dependencies | `venv/bin/pip install -r requirements.txt` |
| Freeze dependencies | `venv/bin/pip freeze > requirements.txt` |

> **Always invoke tests with `-m`** (not `python tests/foo.py`) so `app.*` imports resolve against the package root.

---

## Project Status

CodeRAG is being built in 8 weekly milestones. Current progress:

| Week | Milestone | Status |
|------|-----------|--------|
| 1 | FastAPI skeleton + Groq connectivity | ✅ Complete |
| 2 | GitHub clone + AST parsing + chunking | ✅ Complete |
| 3 | Embeddings + ChromaDB ingestion | ⏳ Next |
| 4 | Retrieval + reranking + streaming chat | 🔜 Planned |
| 5–7 | Frontend (Vite + React + shadcn/ui) | 🔜 Planned |
| 8 | Deployment (Railway + Vercel) | 🔜 Planned |

---

## Environment Setup

1. Copy `.env.example` → `.env`
2. Fill in `GROQ_API_KEY` (free key at [console.groq.com](https://console.groq.com))
3. All other settings have safe defaults

> ⚠️ The `.env` file **must exist** — `pydantic-settings` fails on startup without it.

### Configuration (`app/config.py`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `GROQ_API_KEY` | *(required)* | LLM inference |
| `ENVIRONMENT` | `development` | Runtime mode |
| `LOG_LEVEL` | `INFO` | Logger verbosity |
| `REPOS_PATH` | `./data/repos` | Cloned repos directory |
| `CHROMA_DB_PATH` | `./data/chroma` | Vector store directory |
| `MAX_REPO_SIZE_MB` | `500` | Reject oversized repos |
| `CORS_ORIGINS` | `http://localhost:5173` | Vite dev server |

---

## Architecture Overview

CodeRAG is a **Retrieval-Augmented Generation** system that answers natural-language questions about any public GitHub repository.

```
┌───────────┐    ┌──────────┐    ┌────────────┐    ┌───────────┐
│  GitHub   │ ─► │  Ingest  │ ─► │  Vector DB │ ─► │   Query   │
│   URL     │    │ pipeline │    │ (ChromaDB) │    │ + LLM     │
└───────────┘    └──────────┘    └────────────┘    └───────────┘
                      │                                  │
                  Week 1–2 ✅                       Week 3–4 ⏳
```

### Stage 1 — Ingest Pipeline (Implemented)

`clone → walk → parse → chunk`

| Module | Responsibility |
|--------|----------------|
| `services/github.py` | Validates URL, generates `repo_id`, clones to `data/repos/{repo_id}` |
| `utils/file_walker.py` | Walks repo, filters by extension and size, skips junk dirs |
| `services/parser.py` | Tree-sitter AST parsing → extracts functions and classes |
| `services/chunking.py` | Orchestrates walker + parser, assigns `chunk_id`, returns clean chunks |

### Stage 2 — Embed & Store (Planned, Week 3)

- `sentence-transformers` (BGE-small-en-v1.5) for 384-dim embeddings
- ChromaDB collections keyed per `repo_id`
- Background ingestion task with progress polling

### Stage 3 — Query (Planned, Week 4)

- Vector search (top-15) → BGE reranker (top-5) → Groq LLaMA 3.3 70B
- SSE streaming response with parsed citations
- Conversation memory for follow-up questions

---

## Key Conventions

### `repo_id` — The Universal Key

A normalized identifier derived from the GitHub URL (`tiangolo/fastapi` → `tiangolo_fastapi`).

It is the **single stable key** across the entire system:
- Disk path: `data/repos/{repo_id}/`
- Vector DB namespace
- API route parameter: `/api/repos/{repo_id}/...`
- Chunk ID prefix

### `chunk_id` Format

```
{repo_id}:{relative_path}:{index}
```

Example: `psf_requests:src/auth.py:3`

This guarantees global uniqueness and makes citations traceable end-to-end.

### Chunk Schema

Every chunk produced by `chunking.chunk_repository()` follows this shape:

```python
{
    "chunk_id":    "psf_requests:src/auth.py:3",
    "file_path":   "src/auth.py",        # relative to repo root
    "name":        "HTTPBasicAuth",
    "chunk_type":  "class",              # "function" | "class" | "code_block"
    "content":     "class HTTPBasicAuth...",
    "start_line":  42,
    "end_line":    67,
}
```

### File Filtering Rules (`utils/file_walker.py`)

| Allow | Deny |
|-------|------|
| `.py .js .ts .jsx .tsx` | All other extensions |
| Files ≤ 500 KB | Files > 500 KB |
| Source files | `node_modules/`, `.git/`, `venv/`, `__pycache__/`, `dist/`, `build/` |
| Hand-written code | `*.min.js`, `*.min.css`, `*-lock.json`, `yarn.lock`, `poetry.lock` |

---

## API Contract

Pydantic schemas in `app/models/schemas.py` define the full API surface. **Routes are not yet implemented**, but the contracts are locked.

| Endpoint | Schema | Status |
|----------|--------|--------|
| `GET  /api/health` | `HealthResponse` | ✅ Live |
| `POST /api/repos/ingest` | `IngestRequest` → `IngestResponse` | 🔜 Week 3 |
| `GET  /api/repos/{repo_id}/status` | `RepoStatus` | 🔜 Week 3 |
| `GET  /api/repos` | `list[RepoInfo]` | 🔜 Week 3 |
| `DELETE /api/repos/{repo_id}` | — | 🔜 Week 3 |
| `POST /api/chat` (SSE) | `ChatRequest` | 🔜 Week 4 |
| `GET  /api/repos/{repo_id}/file` | — | 🔜 Week 6 |

---

## Tech Stack

### Backend (Python 3.9+)

| Layer | Tool | Notes |
|-------|------|-------|
| API | FastAPI + Uvicorn | Async-first, auto-generated OpenAPI |
| Validation | Pydantic v2 + pydantic-settings | Strict request/response typing |
| Parsing | tree-sitter + tree-sitter-language-pack | ≥ 0.22 API — use `get_parser('python')`, **not** `parser.set_language()` |
| Cloning | GitPython | Shallow clones planned |
| Embeddings | sentence-transformers (BGE-small) | Planned |
| Vector store | ChromaDB | Local persistence, no server |
| LLM | Groq SDK (LLaMA 3.3 70B) | Free tier, streaming |

### Frontend (Planned)

Vite + React 18 + TypeScript + Tailwind + shadcn/ui — placeholder at `frontend/`, dev server on port `5173`.

---

## Code Style & Conventions

- **Type hints everywhere** — every function signature and return type
- **Docstrings on public functions** — explain *why*, not *what*
- **Logging over print** — use the standard `logging` module with module-level loggers
- **Constants in UPPER_SNAKE_CASE** at module top (e.g. `SUPPORTED_EXTENSIONS`, `MAX_CHUNK_CHARS`)
- **One service = one responsibility** — `github.py` only clones, `parser.py` only parses
- **Fail loudly** — raise clear exceptions with actionable messages; never swallow errors silently
- **No magic numbers** — name every threshold (file size, chunk size, top-k) as a config or constant

---

## Project Layout

```
coderag/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # pydantic-settings
│   │   ├── api/                 # Route handlers (per resource)
│   │   ├── services/            # Business logic (github, parser, chunking, ...)
│   │   ├── models/schemas.py    # Pydantic request/response models
│   │   └── utils/               # Pure helpers (file_walker, ...)
│   ├── data/
│   │   ├── repos/               # Cloned repos (gitignored)
│   │   └── chroma/              # Vector store (gitignored)
│   ├── tests/                   # Smoke tests (run with `-m`)
│   ├── requirements.txt
│   └── .env.example
├── frontend/                    # Vite + React (Week 5+)
└── docs/
```

---

## Common Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: app` | Ran `python tests/foo.py` directly | Use `python -m tests.foo` from `backend/` |
| `pydantic_core._pydantic_core.ValidationError` on startup | Missing `.env` or `GROQ_API_KEY` | Copy `.env.example` → `.env` and fill key |
| `tree_sitter.Language` errors | Using old API | Use `tree_sitter_language_pack.get_parser('python')` |
| Port 8000 in use | Stale uvicorn process | `lsof -ti:8000 \| xargs kill -9` |
| Git tries to commit cloned repos | Forgot `.gitignore` | Ensure `data/repos/` and `data/chroma/` are gitignored |

---

## When Modifying This Project

1. **Stay within the defined stack** — no new dependencies without updating `requirements.txt` and this file.
2. **Preserve `repo_id` and `chunk_id` formats** — they are referenced across modules and the API.
3. **Update schemas first, code second** — the API contract in `schemas.py` is the source of truth.
4. **Run both smoke tests** before commit: `test_groq.py` and `test_parser.py`.
5. **Keep `data/` out of Git** — already gitignored, but worth re-checking.