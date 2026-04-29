// Mirrors app/models/schemas.py — keep in sync with backend Pydantic models.

export interface RepoStatus {
  repo_id: string
  status: 'pending' | 'cloning' | 'parsing' | 'embedding' | 'ready' | 'error'
  progress: number        // 0–100, matches Python int
  message: string
  file_count: number
  chunk_count: number
  error: string | null    // Optional[str] in Python → string | null here
}

export interface RepoInfo {
  repo_id: string
  name: string
  github_url: string
  status: string
  chunk_count: number
  created_at: string      // ISO 8601 string; Python sends datetime serialized as str
}

export interface IngestRequest {
  github_url: string
  branch?: string         // backend defaults to "main" if omitted
}

export interface IngestResponse {
  repo_id: string
  status: string
  message: string
}

// Represents a retrieved code chunk attached to an assistant reply.
// Mirrors CodeChunk in schemas.py, plus chunk_id for citation tracing.
export interface ChunkSource {
  chunk_id: string        // format: "{repo_id}:{file_path}:{index}"
  file_path: string
  name: string
  chunk_type: string      // "function" | "class" | "code_block"
  start_line: number
  end_line: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: ChunkSource[] // only present on assistant messages that have citations
}

export interface ChatRequest {
  question: string
  repo_id: string
  conversation_history: ChatMessage[]
}

// Describes each event in the SSE stream from POST /api/chat.
// The backend emits: sources → token (repeated) → done | error
export interface SSEEvent {
  type: 'sources' | 'token' | 'done' | 'error'
  data: unknown           // narrowed at the call site based on `type`
}
