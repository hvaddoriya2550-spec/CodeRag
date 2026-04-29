import axios from 'axios'
import type {
  IngestRequest,
  IngestResponse,
  RepoStatus,
  RepoInfo,
  FileContent,
  ChatRequest,
  SSEEvent,
} from '@/types'

// Reads from .env (VITE_ prefix required — see bottom of file for why).
// Falls back to localhost for local dev when .env is absent.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30_000,
})

// Unwrap FastAPI's { detail: "..." } error shape into a plain Error.
// Every rejected axios call in this file will have a human-readable message.
apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.detail ?? err.message
    return Promise.reject(new Error(message))
  }
)

// ---------------------------------------------------------------------------
// Repo endpoints
// ---------------------------------------------------------------------------

export async function ingestRepo(githubUrl: string): Promise<IngestResponse> {
  const body: IngestRequest = { github_url: githubUrl, branch: 'main' }
  const res = await apiClient.post<IngestResponse>('/api/repos/ingest', body)
  return res.data
}

export async function getRepoStatus(repoId: string): Promise<RepoStatus> {
  const res = await apiClient.get<RepoStatus>(`/api/repos/${repoId}/status`)
  return res.data
}

export async function listRepos(): Promise<RepoInfo[]> {
  const res = await apiClient.get<RepoInfo[]>('/api/repos')
  return res.data
}

export async function deleteRepo(repoId: string): Promise<{ deleted: boolean }> {
  const res = await apiClient.delete<{ deleted: boolean }>(`/api/repos/${repoId}`)
  return res.data
}

export async function checkHealth(): Promise<{ status: string }> {
  const res = await apiClient.get<{ status: string }>('/api/health')
  return res.data
}

export async function getFileContent(repoId: string, path: string): Promise<FileContent> {
  const res = await apiClient.get<FileContent>(`/api/repos/${repoId}/file`, { params: { path } })
  return res.data
}

// ---------------------------------------------------------------------------
// Streaming chat (SSE via fetch, not axios)
//
// Why fetch instead of axios:
//   axios buffers the entire response before resolving. SSE sends hundreds of
//   small chunks over seconds — we need each chunk as it arrives, not all at
//   once at the end. The native fetch ReadableStream API gives us that.
//
// SSE wire format (each "message" is separated by a blank line):
//   event: token\n
//   data: {"chunk": "Hello"}\n
//   \n
// ---------------------------------------------------------------------------

export async function streamChat(
  request: ChatRequest,
  onEvent: (event: SSEEvent) => void,
  onError: (err: Error) => void,
  signal?: AbortSignal
): Promise<void> {
  let response: Response

  try {
    response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal,
    })
  } catch (err) {
    // Network failure or AbortError (user navigated away — not a real error)
    if (err instanceof DOMException && err.name === 'AbortError') return
    onError(err instanceof Error ? err : new Error(String(err)))
    return
  }

  if (!response.ok) {
    onError(new Error(`Chat request failed: ${response.status} ${response.statusText}`))
    return
  }

  if (!response.body) {
    onError(new Error('Response body is null — server did not send a stream'))
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // Append the new bytes (decoded) to whatever was left over from last chunk
      buffer += decoder.decode(value, { stream: true })

      // SSE messages are delimited by a blank line (\n\n).
      // One read() call may contain 0, 1, or many complete messages.
      const messages = buffer.split('\n\n')

      // The last element is either empty (message ended cleanly) or an
      // incomplete message that needs the next read() to finish it.
      buffer = messages.pop() ?? ''

      for (const message of messages) {
        if (!message.trim()) continue

        let eventType = 'message'
        let rawData = ''

        for (const line of message.split('\n')) {
          if (line.startsWith('event:')) {
            eventType = line.slice('event:'.length).trim()
          } else if (line.startsWith('data:')) {
            rawData = line.slice('data:'.length).trim()
          }
        }

        try {
          const parsed: unknown = JSON.parse(rawData)
          onEvent({ type: eventType as SSEEvent['type'], data: parsed })
        } catch {
          // Non-JSON data line (e.g. a keep-alive comment) — skip silently
        }
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return
    onError(err instanceof Error ? err : new Error(String(err)))
  } finally {
    reader.releaseLock()
  }
}
