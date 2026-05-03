import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, FolderOpen, MessageSquare,
  FileText, Activity, Terminal, Search, Bell, Settings,
  Trash2, GitBranch, Share2, History, Plus,
} from 'lucide-react'
import confetti from 'canvas-confetti'
import { useReposStore } from '@/store/reposStore'
import { useChatStore } from '@/store/chatStore'
import { MessageList } from '@/components/chat/MessageList'
import { ChatInput } from '@/components/chat/ChatInput'
import { CodeViewer } from '@/components/code/CodeViewer'
import type { ChatMessage, RepoStatus } from '@/types'
import * as api from '@/lib/api'

const EMPTY_MESSAGES: ChatMessage[] = []

// ── Shared header ─────────────────────────────────────────────────────────────

function TopBar({ title, subtitle, children }: { title?: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="absolute top-0 left-0 right-0 h-12 bg-[#0a0a0f] border-b border-[#222] flex items-center justify-between px-4 z-20 shrink-0">
      <span className="font-heading font-bold text-[#b9ff66] text-xl tracking-[0.15em] uppercase">
        CODERAG_V1.0
      </span>
      {subtitle && (
        <div className="flex items-center gap-6">
          <span className="font-mono font-medium text-xs text-[#b9ff66] tracking-tight uppercase border-b-2 border-[#b9ff66] pb-0.5">{title}</span>
          {subtitle && <span className="font-mono font-medium text-xs text-[#71717a] tracking-tight uppercase px-2">{subtitle}</span>}
        </div>
      )}
      {children}
    </header>
  )
}

// ── Ingesting progress view ───────────────────────────────────────────────────

const STAGE_LABELS = ['CLONE', 'PARSE', 'EMBED', 'READY']
const STAGE_MAP: Record<string, number> = { pending: 0, cloning: 0, parsing: 1, embedding: 2, ready: 3 }

const NAV_ITEMS = [
  { icon: FolderOpen,    label: 'REPOSITORY' },
  { icon: MessageSquare, label: 'CONVERSATIONS' },
  { icon: FileText,      label: 'FILE_INDEX' },
  { icon: Activity,      label: 'SYSTEM_LOGS', active: true },
  { icon: Terminal,      label: 'TERMINAL' },
]

function IngestingView({ name, status }: { name: string; status: RepoStatus | null }) {
  const navigate = useNavigate()
  const progress   = status?.progress ?? 0
  const message    = status?.message ?? 'Initializing...'
  const stageKey   = status?.status ?? 'pending'
  const activeStep = STAGE_MAP[stageKey] ?? 0
  const isReady    = stageKey === 'ready'
  const fileCount  = status?.file_count ?? 0
  const chunkCount = status?.chunk_count ?? 0

  // Heatmap: 20 squares (2 rows × 10 cols), filled proportionally to progress
  const totalSquares = 20
  const filledCount  = Math.round((progress / 100) * totalSquares)
  const activeIdx    = filledCount // next square to animate

  // Simulate scrolling log lines
  const logTime = new Date().toTimeString().slice(0, 8)
  const stageLabel = STAGE_LABELS[Math.min(activeStep, 3)] ?? 'PENDING'

  return (
    <div className="relative h-full bg-[#0a0a0f] overflow-hidden">
      <TopBar title="INGESTION" subtitle="REPOSITORY" />

      {/* Sidebar */}
      <aside className="absolute left-0 top-12 bottom-0 w-64 bg-[#111118] border-r border-[#222] flex flex-col z-10">
        <div className="border-b border-[#222] px-6 py-6">
          <p className="font-mono font-bold text-[#b9ff66] text-xs">ROOT_SYSTEM</p>
          <p className="font-mono text-[10px] text-[#71717a] tracking-wide uppercase mt-0.5">STATUS: ENCRYPTED</p>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={`flex items-center gap-3 px-6 py-3 cursor-pointer transition-colors
                ${active
                  ? 'bg-[#0a0a0f] border-l-2 border-[#b9ff66] pl-[22px] text-[#b9ff66]'
                  : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="font-mono text-xs tracking-wide uppercase">{label}</span>
            </div>
          ))}
        </nav>
        <div className="p-4">
          <button
            onClick={() => navigate('/')}
            className="w-full border border-[#b9ff66] py-3 font-mono text-xs text-[#b9ff66] tracking-widest uppercase hover:bg-[rgba(185,255,102,0.05)] transition-colors"
          >
            INIT_NEW_SCAN
          </button>
        </div>
      </aside>

      {/* Main canvas */}
      <main className="absolute left-64 right-0 top-12 bottom-0 flex items-center justify-center overflow-hidden">
        {/* Decorative ghost bars (bottom-left) */}
        <div className="absolute bottom-12 left-12 opacity-10 flex flex-col gap-2">
          <div className="flex items-end gap-1">
            {[128,96,160,48,112].map((h, i) => (
              <div key={i} className="w-1 bg-[#b9ff66]" style={{ height: h }} />
            ))}
          </div>
          <span className="font-mono text-[8px] text-[#b9ff66]">LATENCY_STABILITY_MONITOR</span>
        </div>

        {/* Decorative corner element (top-right) */}
        <div className="absolute top-12 right-12 opacity-20 border border-[#b9ff66] p-4 flex flex-col gap-2">
          <div className="w-32 h-1 bg-[#b9ff66]" />
          <div className="w-16 h-1 bg-[#b9ff66]" />
          <div className="w-24 h-1 bg-[#b9ff66]" />
        </div>

        {/* Progress block */}
        <div className="bg-[#111118] border border-[#222] w-[560px] flex flex-col gap-6 p-3">
          {/* Header */}
          <div className="border-b border-[#222] pb-3 flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="font-mono font-medium text-xs text-[#71717a]">CURRENT_CONTEXT:</span>
              <span className="font-mono font-bold text-xl text-white tracking-tight">{name}</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="font-mono text-[10px] text-[#71717a] text-right">UID: 8821-X9</span>
              <span className="font-mono font-medium text-xs text-[#b9ff66] text-right">ACTIVE_THREAD</span>
            </div>
          </div>

          {/* Status heading */}
          <div className="flex flex-col gap-2">
            <h2 className={`font-mono font-bold text-[48px] leading-none tracking-[-0.05em] uppercase ${isReady ? 'text-white' : 'text-[#b9ff66]'}`}>
              {isReady ? 'READY.' : stageLabel + '...'}
            </h2>
            <p className="font-mono text-base text-[#71717a] tracking-widest uppercase">{message}</p>
          </div>

          {/* Heatmap grid: 10 × 2 */}
          <div className="grid grid-cols-10 gap-2 py-6">
            {Array.from({ length: totalSquares }).map((_, i) => {
              const filled  = i < filledCount
              const isActive = i === activeIdx && !isReady
              return (
                <div
                  key={i}
                  className={`h-8 border transition-colors duration-500 ${
                    filled
                      ? 'bg-[#b9ff66] border-[#b9ff66]'
                      : isActive
                        ? 'border-[#b9ff66] border-opacity-50 bg-[rgba(185,255,102,0.3)]'
                        : 'bg-[#0a0a0f] border-[#222]'
                  } ${isActive ? 'animate-pulse' : ''}`}
                />
              )
            })}
          </div>

          {/* Stepper labels */}
          <div className="border-t border-[#222] pt-3 flex items-start justify-between">
            {STAGE_LABELS.map((label, i) => {
              const done    = i < activeStep
              const current = i === activeStep
              const pending = i > activeStep
              return (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    {done ? (
                      <div className="w-3 h-3 rounded-full bg-[#b9ff66] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0a0a0f]" />
                      </div>
                    ) : (
                      <div className={`w-3 h-3 rounded-full border ${current ? 'border-[#b9ff66]' : 'border-[#52525b]'}`} />
                    )}
                    <span className={`font-mono text-[10px] uppercase ${
                      current ? 'text-[#b9ff66] font-bold' : pending ? 'text-[#52525b]' : 'text-[#d4d4d8]'
                    }`}>{label}</span>
                  </div>
                  {current && <div className="w-full h-0.5 bg-[#b9ff66]" />}
                </div>
              )
            })}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-px bg-[#222] border border-[#222]">
            <div className="bg-[#111118] p-4 flex flex-col gap-1">
              <span className="font-mono text-base text-[#71717a] uppercase">FILES PROCESSED</span>
              <span className="font-mono font-bold text-xl text-white">
                {fileCount > 0 ? fileCount : '—'}
                <span className="text-[#b9ff66]">/</span>
                {status?.file_count ?? '—'}
              </span>
            </div>
            <div className="bg-[#111118] p-4 flex flex-col gap-1">
              <span className="font-mono text-base text-[#71717a] uppercase">CHUNKS INDEXED</span>
              <span className="font-mono font-bold text-xl text-white">
                {chunkCount > 0 ? chunkCount.toLocaleString() : '—'}
              </span>
            </div>
          </div>

          {/* Log overlay */}
          <div className="bg-[#050508] border border-[#222] p-3 h-24 overflow-hidden font-mono text-[10px] flex flex-col gap-1">
            <div className="flex gap-4">
              <span className="text-[#b9ff66] shrink-0">[{logTime}]</span>
              <span className="text-[#a1a1aa]">INIT ingestion pipeline for {name}...</span>
            </div>
            <div className="flex gap-4">
              <span className="text-[#b9ff66] shrink-0">[{logTime}]</span>
              <span className="text-[#a1a1aa]">STAGE: {stageLabel} — {message}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-[#b9ff66] shrink-0">[{logTime}]</span>
              <span className="text-white">Progress: {progress}%</span>
            </div>
            {isReady && (
              <div className="flex gap-4">
                <span className="text-[#b9ff66] shrink-0">[{logTime}]</span>
                <span className="text-[#b9ff66]">✓ INGESTION COMPLETE — launching chat...</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Error view ────────────────────────────────────────────────────────────────

function ErrorView({ error, onDelete }: { error: string; onDelete: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="h-full bg-[#0a0a0f] flex flex-col items-center justify-center gap-6 px-4">
      <TopBar />
      <div className="border border-[#222] bg-[#111118] p-8 flex flex-col items-center gap-4 max-w-sm w-full text-center">
        <AlertCircle className="w-10 h-10 text-[#ef4444]" />
        <p className="font-mono font-bold text-white">INGESTION_FAILED</p>
        <p className="font-mono text-xs text-[#a1a1aa] leading-5">{error}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 border border-[#222] px-4 py-2 font-mono text-xs text-[#a1a1aa] hover:text-white hover:border-[#444] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> BACK
          </button>
          <button
            onClick={onDelete}
            className="flex items-center gap-2 border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-2 font-mono text-xs text-[#ef4444] hover:bg-[#ef4444]/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> DELETE
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Not-found view ────────────────────────────────────────────────────────────

function NotFoundView() {
  const navigate = useNavigate()
  return (
    <div className="h-full bg-[#0a0a0f] flex flex-col items-center justify-center gap-4">
      <TopBar />
      <AlertCircle className="w-10 h-10 text-[#52525b]" />
      <p className="font-mono text-sm text-[#a1a1aa]">REPOSITORY_NOT_FOUND</p>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 border border-[#222] px-4 py-2 font-mono text-xs text-[#a1a1aa] hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> BACK
      </button>
    </div>
  )
}

// ── Main chat page ────────────────────────────────────────────────────────────

export default function ChatPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate   = useNavigate()

  const [viewerFile,  setViewerFile]  = useState<string | null>(null)
  const [viewerRange, setViewerRange] = useState<{ start: number; end: number } | null>(null)
  const [pollStatus,  setPollStatus]  = useState<RepoStatus | null>(null)

  const confettiFired = useRef(false)

  const repos         = useReposStore((s) => s.repos)
  const repo          = useReposStore((s) => (repoId ? s.getRepoById(repoId) : undefined))
  const isLoadingRepos = useReposStore((s) => s.isLoading)
  const loadRepos     = useReposStore((s) => s.loadRepos)
  const removeRepo    = useReposStore((s) => s.removeRepo)

  const messages   = useChatStore((s) => (repoId ? s.getMessages(repoId) : EMPTY_MESSAGES))
  const isStreaming = useChatStore((s) => s.isStreaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const clearChat  = useChatStore((s) => s.clearChat)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadRepos() }, [])

  useEffect(() => {
    if (!repoId || !repo) return
    if (repo.status === 'ready' || repo.status === 'error') return

    const interval = setInterval(async () => {
      try {
        const status = await api.getRepoStatus(repoId)
        setPollStatus(status)
        if (status.status === 'ready') {
          clearInterval(interval)
          if (!confettiFired.current) {
            confettiFired.current = true
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#b9ff66', '#a8f050', '#ffffff'] })
          }
          setTimeout(async () => {
            await loadRepos()
            navigate(`/chat/${repoId}`)
          }, 1200)
        } else if (status.status === 'error') {
          clearInterval(interval)
          await loadRepos()
        }
      } catch { clearInterval(interval) }
    }, 2000)

    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoId, repo?.status])

  const handleCitation = (filePath: string, start: number, end: number) => {
    setViewerFile(filePath)
    setViewerRange({ start, end })
  }

  const handleSend   = (msg: string) => { if (repoId) sendMessage(repoId, msg) }
  const handleDelete = async () => {
    if (!repoId) return
    if (!confirm(`Delete ${repoId}? This cannot be undone.`)) return
    await removeRepo(repoId)
    navigate('/')
  }

  if (isLoadingRepos && !repo) return null
  if (!repo) return <NotFoundView />
  if (repo.status !== 'ready' && repo.status !== 'error') {
    return <IngestingView name={repo.name} status={pollStatus} />
  }
  if (repo.status === 'error') {
    return <ErrorView error={pollStatus?.error ?? 'An unknown error occurred.'} onDelete={handleDelete} />
  }

  // ── Ready: 3-panel layout ──

  return (
    <div className="relative h-full bg-[#0a0a0f] flex flex-col overflow-hidden">

      {/* ── Top bar ── */}
      <header className="h-12 bg-[#0a0a0f] border-b border-[#222] flex items-center justify-between px-4 shrink-0 z-20">
        <span className="font-heading font-bold text-[#b9ff66] text-xl tracking-[0.15em] uppercase">
          CODERAG_V1.0
        </span>
        <div className="flex items-center gap-6">
          <div className="flex gap-4 items-center">
            <button className="p-1 text-[#71717a] hover:text-white transition-colors"><Search className="w-4.5 h-4.5" /></button>
            <button className="p-1 text-[#71717a] hover:text-white transition-colors"><Bell className="w-4.5 h-4.5" /></button>
            <button className="p-1 text-[#71717a] hover:text-white transition-colors"><Settings className="w-4.5 h-4.5" /></button>
          </div>
          <div className="w-px h-6 bg-[#222]" />
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#b9ff66]" />
            <span className="font-mono font-bold text-[10px] text-[#b9ff66] tracking-widest uppercase">SYSTEM_LIVE</span>
          </div>
        </div>
      </header>

      {/* ── 3-panel body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left panel: repo list ── */}
        <aside className="w-[220px] bg-[#111118] border-r border-[#222] flex flex-col shrink-0">
          {/* Header */}
          <div className="border-b border-[#222] px-4 py-[17px] flex items-center justify-between">
            <span className="font-mono font-bold text-[#b9ff66] text-xs tracking-wide uppercase">REPOS</span>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1 border border-[#222] px-2 py-1 font-mono text-xs text-[#e0e4d4] hover:border-[#444] transition-colors"
            >
              NEW <Plus className="w-3 h-3" />
            </button>
          </div>

          {/* Repo list */}
          <div className="flex-1 overflow-y-auto">
            {repos.map((r) => {
              const isActive = r.repo_id === repoId
              return (
                <button
                  key={r.repo_id}
                  onClick={() => navigate(`/chat/${r.repo_id}`)}
                  className={`w-full text-left flex flex-col gap-1 py-3 border-b border-[rgba(34,34,34,0.5)] transition-colors
                    ${isActive
                      ? 'pl-[18px] pr-4 border-l-2 border-l-[#b9ff66] bg-[#0a0a0f]'
                      : 'px-4 hover:bg-[#0a0a0f]/50'}`}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className={`w-3 h-3 shrink-0 ${isActive ? 'text-[#b9ff66]' : 'text-[#71717a]'}`} />
                    <span className={`font-mono text-xs tracking-wide uppercase truncate ${isActive ? 'text-[#b9ff66]' : 'text-[#71717a]'}`}>
                      {r.name.replace('/', '/')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between opacity-70 pl-5">
                    <span className={`font-mono text-[9px] uppercase tracking-wide ${isActive ? 'text-[#b9ff66]' : 'text-[#71717a]'}`}>
                      {r.chunk_count.toLocaleString()} CHUNKS
                    </span>
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${r.status === 'ready' ? 'bg-[#b9ff66]' : 'bg-[#52525b]'}`} />
                      <span className={`font-mono text-[9px] uppercase ${isActive ? 'text-[#b9ff66]' : 'text-[#71717a]'}`}>
                        {r.status === 'ready' ? 'READY' : 'IDLE'}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Storage indicator */}
          <div className="bg-[#0a0a0f] border-t border-[#222] px-4 py-4 flex flex-col gap-2">
            <span className="font-mono text-[9px] text-[#71717a] tracking-widest uppercase">STORAGE_LOAD</span>
            <div className="w-full h-1 bg-[#222]">
              <div className="h-full bg-[#b9ff66] transition-all" style={{ width: `${Math.min(repos.length * 15, 100)}%` }} />
            </div>
          </div>
        </aside>

        {/* ── Middle panel: chat ── */}
        <div className="flex-1 min-w-0 bg-[#0a0a0f] flex flex-col overflow-hidden">
          {/* Chat header */}
          <div className="h-12 bg-[rgba(17,17,24,0.8)] backdrop-blur border-b border-[#222] flex items-center justify-between px-6 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-heading text-white text-base tracking-tight">{repo.name}</span>
              <div className="bg-[rgba(185,255,102,0.1)] border border-[rgba(185,255,102,0.3)] px-2 py-0.5">
                <span className="font-mono text-[10px] text-[#b9ff66]">{repo.chunk_count.toLocaleString()} CHUNKS</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => repoId && clearChat(repoId)}
                disabled={isStreaming || messages.length === 0}
                className="text-[#71717a] hover:text-white transition-colors disabled:opacity-30"
                title="Clear chat"
              >
                <History className="w-4.5 h-4.5" />
              </button>
              <button
                onClick={handleDelete}
                className="text-[#71717a] hover:text-[#ef4444] transition-colors"
                title="Delete repo"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
              <Share2 className="w-4.5 h-4.5 text-[#71717a]" />
            </div>
          </div>

          <MessageList messages={messages} isStreaming={isStreaming} onCitationClick={handleCitation} />
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>

        {/* ── Right panel: code viewer ── */}
        <aside className="w-[480px] bg-[#111118] border-l border-[#222] flex flex-col shrink-0">
          <CodeViewer
            repoId={repoId!}
            filePath={viewerFile}
            highlightRange={viewerRange}
            onClose={() => { setViewerFile(null); setViewerRange(null) }}
          />
        </aside>
      </div>

      {/* ── Status bar ── */}
      <div className="h-6 bg-[#111118] border-t border-[#222] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#b9ff66]" />
            <span className="font-mono text-[10px] text-[#71717a]">CONNECTION_STABLE</span>
          </div>
          <span className="font-mono text-[10px] text-[#71717a]">LATENCY: 14MS</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[10px] text-[#71717a]">MEM: 1.4GB / 4.0GB</span>
          <span className="font-mono text-[10px] text-[#3f3f46]">|</span>
          <span className="font-mono text-[10px] text-[#b9ff66]">v1.0.0-STABLE</span>
        </div>
      </div>

    </div>
  )
}
