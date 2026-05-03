# CodeRAG

> Chat with any GitHub repository. Paste a URL, get answers with exact source citations.

CodeRAG indexes a codebase using AST parsing and vector embeddings, then lets you ask natural-language questions about it — with every answer grounded in the actual code and linked back to the precise file and line.

---

## How it works

```
GitHub URL
    │
    ▼
Clone ──► AST Parse (tree-sitter) ──► Chunk by function/class
                                             │
                                             ▼
                                    Embed (BGE-small-en-v1.5)
                                             │
                                             ▼
                                    Store in ChromaDB
                                             │
    ┌────────────────────────────────────────┘
    │
    ▼  (at query time)
Vector Search (top-15)
    │
    ▼
Keyword Boost + BGE Reranker (top-5)
    │
    ▼
LLaMA 3.3 70B via Groq (streaming)
    │
    ▼
Answer with inline citations [file:start-end]
```

The pipeline has three stages:

**Ingest** — Clones the repo, walks source files (`.py .js .ts .tsx .jsx`), parses each with tree-sitter to extract named functions and classes as discrete chunks, embeds them with BGE-small, and stores them in a per-repo ChromaDB collection.

**Retrieve** — Embeds the user's question, does an HNSW vector search for the top-15 candidates, applies a keyword boost for exact function/class name matches, then reruns through a BGE cross-encoder reranker to select the top-5 most relevant chunks.

**Answer** — Builds a context-budget-aware prompt (fits within Groq's 12K TPM free tier), streams the answer token-by-token over SSE, and enforces inline citations on every factual claim.

---

## Features

- **AST-level chunking** — chunks are extracted functions and classes, not arbitrary text windows. Every citation is meaningful.
- **Hybrid retrieval** — vector similarity + keyword boost for exact name lookups. Asking about `HTTPBasicAuth` surfaces it even when cosine distance would bury it.
- **BGE reranker** — cross-encoder second pass cuts noise and surfaces the chunks actually relevant to the question, not just topically similar ones.
- **Query rewriting** — follow-up questions ("how does it handle errors?") are rewritten into standalone queries via a fast LLaMA 3.1 8B step before embedding, keeping conversation context accurate.
- **Streaming UI** — answers arrive token-by-token. A code viewer lets you jump to the exact file and line cited in any answer.
- **Persistent index** — ChromaDB collections survive server restarts. Repos indexed once are immediately available on next startup without re-ingestion.
- **Token budget management** — the prompt builder greedily packs chunks up to an 8K token budget, always including the highest-ranked chunks first.

---

## Stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI + Uvicorn |
| Parsing | tree-sitter + tree-sitter-language-pack |
| Embeddings | `BAAI/bge-small-en-v1.5` (384-dim, via sentence-transformers) |
| Reranker | BGE cross-encoder |
| Vector store | ChromaDB (local, HNSW) |
| LLM | Groq — LLaMA 3.3 70B (chat) + LLaMA 3.1 8B (query rewrite) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| State | Zustand |

---

## Getting started

### Prerequisites

- Python 3.9+
- Node.js 18+
- A free Groq API key — [console.groq.com](https://console.groq.com)

### Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and set GROQ_API_KEY=<your-key>

# Start the API server
python -m app.main
# API available at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App available at http://localhost:5173
```

---

## Usage

1. Open `http://localhost:5173`
2. Paste any public GitHub URL (e.g. `https://github.com/encode/httpx`)
3. Click **INGEST** — indexing takes under 60 seconds for most repos
4. Ask questions in plain English:
   - *"How does authentication work?"*
   - *"What does the retry logic look like?"*
   - *"Where is the connection pool configured?"*
5. Every answer includes `[file_path:start_line-end_line]` citations. Click any citation to open the exact code in the viewer.

---

## API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/repos/ingest` | Start indexing a GitHub repo |
| `GET` | `/api/repos/{repo_id}/status` | Poll ingestion progress |
| `GET` | `/api/repos` | List all indexed repos |
| `DELETE` | `/api/repos/{repo_id}` | Remove a repo and its index |
| `POST` | `/api/chat` | SSE streaming chat (RAG) |
| `GET` | `/api/repos/{repo_id}/file` | Fetch raw file content |

---

## Project layout

```
coderag/
├── backend/
│   ├── app/
│   │   ├── api/            # Route handlers (repos, chat)
│   │   ├── services/       # chunking, embedding, retrieval,
│   │   │                   # reranker, llm, prompt_builder,
│   │   │                   # vector_store, status_store, github
│   │   ├── models/         # Pydantic schemas
│   │   └── utils/          # file_walker
│   ├── data/
│   │   ├── repos/          # Cloned repos (gitignored)
│   │   └── chroma/         # Vector store (gitignored)
│   └── tests/
└── frontend/
    └── src/
        ├── components/     # chat, code viewer, layout, shadcn/ui
        ├── pages/          # HomePage, ChatPage
        ├── store/          # repos, chat, theme (Zustand)
        └── lib/            # API client
```

---

## Configuration

All settings live in `backend/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | *(required)* | Groq inference API key |
| `ENVIRONMENT` | `development` | Runtime mode |
| `LOG_LEVEL` | `INFO` | Logger verbosity |
| `REPOS_PATH` | `./data/repos` | Where cloned repos are stored |
| `CHROMA_DB_PATH` | `./data/chroma` | ChromaDB persistence path |
| `MAX_REPO_SIZE_MB` | `500` | Max repo size before rejection |
| `CORS_ORIGINS` | `localhost:5173` | Allowed frontend origins |

---

## Chunk ID format

Every chunk has a globally unique, traceable ID:

```
{repo_id}:{relative_file_path}:{index}

# e.g.
encode_httpx:httpx/_client.py:14
```

This same ID is the citation key surfaced in chat answers, making every claim traceable end-to-end from the LLM response back to the exact lines in the original file.
