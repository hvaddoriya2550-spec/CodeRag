import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Trash2 } from 'lucide-react'
import { useReposStore } from '@/store/reposStore'
import { useChatStore } from '@/store/chatStore'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'
import { CodeViewer } from '@/components/code/CodeViewer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { RepoStatus } from '@/types'
import * as api from '@/lib/api'

// ── Ingesting progress view ───────────────────────────────────────────────────

function IngestingView({ name, status }: { name: string; status: RepoStatus | null }) {
  const progress = status?.progress ?? 0
  const message = status?.message ?? 'Preparing…'

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-6 px-4">
      <div className="w-full max-w-md space-y-4">
        <h2 className="text-xl font-semibold text-center">Indexing {name}</h2>
        <p className="text-sm text-muted-foreground text-center">{message}</p>

        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">{progress}%</p>

        {(status?.file_count ?? 0) > 0 && (
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span>{status!.file_count} files</span>
            <span>{status!.chunk_count} chunks</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Error view ────────────────────────────────────────────────────────────────

function ErrorView({
  error,
  onDelete,
}: {
  error: string
  onDelete: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-4 px-4">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <p className="text-base font-semibold">Ingestion failed</p>
      <p className="text-sm text-muted-foreground text-center max-w-sm">{error}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete repo
        </Button>
      </div>
    </div>
  )
}

// ── Not-found view ────────────────────────────────────────────────────────────

function NotFoundView() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-3.5rem)] gap-4">
      <AlertCircle className="h-10 w-10 text-muted-foreground" />
      <p className="text-base font-semibold">Repository not found</p>
      <Button variant="outline" onClick={() => navigate('/')}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to home
      </Button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()

  const [viewerFile, setViewerFile] = useState<string | null>(null)
  const [viewerRange, setViewerRange] = useState<{ start: number; end: number } | null>(null)
  // Detailed status polled from the API while ingestion is in progress.
  // RepoInfo in the store only carries a string status; RepoStatus has progress
  // percentage, message, file/chunk counts, and error detail.
  const [pollStatus, setPollStatus] = useState<RepoStatus | null>(null)

  const repo = useReposStore((s) => (repoId ? s.getRepoById(repoId) : undefined))
  const isLoadingRepos = useReposStore((s) => s.isLoading)
  const loadRepos = useReposStore((s) => s.loadRepos)
  const removeRepo = useReposStore((s) => s.removeRepo)

  const messages = useChatStore((s) => (repoId ? s.getMessages(repoId) : []))
  const isStreaming = useChatStore((s) => s.isStreaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const clearChat = useChatStore((s) => s.clearChat)

  // Fetch the repo list once on mount so `repo` resolves from the store.
  useEffect(() => {
    loadRepos()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll the status endpoint every 2 s while ingestion is in-flight.
  // Stops automatically when the backend reports ready or error, then
  // refreshes the store list so the page transitions to the correct state.
  // Polling is the right choice here because ingestion is a background task
  // started by the backend — there's no push channel (WebSocket/SSE) for
  // status updates at this stage of the project.
  useEffect(() => {
    if (!repoId || !repo) return
    if (repo.status === 'ready' || repo.status === 'error') return

    const interval = setInterval(async () => {
      try {
        const status = await api.getRepoStatus(repoId)
        setPollStatus(status)
        if (status.status === 'ready' || status.status === 'error') {
          clearInterval(interval)
          await loadRepos()
        }
      } catch {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [repoId, repo?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCitation = (filePath: string, start: number, end: number) => {
    setViewerFile(filePath)
    setViewerRange({ start, end })
  }

  const handleSend = (message: string) => {
    if (!repoId) return
    sendMessage(repoId, message)
  }

  const handleDelete = async () => {
    if (!repoId) return
    if (!confirm(`Delete ${repoId}? This cannot be undone.`)) return
    await removeRepo(repoId)
    navigate('/')
  }

  // ── Loading: repos haven't been fetched yet ───────────────────────────────
  // Show nothing while the initial listRepos call is in-flight to avoid a
  // brief "not found" flash before the store populates.
  if (isLoadingRepos && !repo) return null

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!repo) return <NotFoundView />

  // ── Ingestion in progress ─────────────────────────────────────────────────
  if (repo.status !== 'ready' && repo.status !== 'error') {
    return <IngestingView name={repo.name} status={pollStatus} />
  }

  // ── Ingestion failed ──────────────────────────────────────────────────────
  if (repo.status === 'error') {
    return (
      <ErrorView
        error={pollStatus?.error ?? 'An unknown error occurred during ingestion.'}
        onDelete={handleDelete}
      />
    )
  }

  // ── Ready — full split-pane chat layout ───────────────────────────────────
  return (
    <div className="h-[calc(100vh-3.5rem)] grid grid-cols-1 lg:grid-cols-[1fr_1fr] divide-x overflow-hidden">

      {/* ── Left pane: chat ── */}
      <div className="flex flex-col h-full overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold truncate">{repo.name}</h2>
            <p className="text-xs text-muted-foreground">{repo.chunk_count} chunks indexed</p>
          </div>
          <div className="flex items-center gap-2 ml-3 shrink-0">
            <Badge variant="secondary" className="font-mono text-xs">ready</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => repoId && clearChat(repoId)}
              disabled={isStreaming || messages.length === 0}
            >
              Clear
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onCitationClick={handleCitation}
        />

        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>

      {/* ── Right pane: code viewer (desktop only) ── */}
      <div className="hidden lg:flex flex-col h-full overflow-hidden">
        <CodeViewer
          repoId={repoId!}
          filePath={viewerFile}
          highlightRange={viewerRange}
          onClose={() => {
            setViewerFile(null)
            setViewerRange(null)
          }}
        />
      </div>

      {/* ── Mobile: show banner when a citation was clicked ── */}
      {viewerFile && (
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-20 rounded-lg border bg-background shadow-lg p-3 flex items-center justify-between text-sm">
          <span className="font-mono text-xs truncate text-muted-foreground">{viewerFile}</span>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 ml-2 text-xs"
            onClick={() => { setViewerFile(null); setViewerRange(null) }}
          >
            Dismiss
          </Button>
        </div>
      )}
    </div>
  )
}
