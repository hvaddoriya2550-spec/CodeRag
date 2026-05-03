import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReposStore } from '@/store/reposStore'
import {
  ArrowRight, GitBranch, Settings, Zap, Shield, Network,
  Sparkles, ChevronRight,
} from 'lucide-react'

// ── Animated code-graph doodle ───────────────────────────────────────────────

function CodeDoodle() {
  const cx = 100, cy = 100
  const nodes = [
    { id: 0, x: 100, y: 28,  label: 'PARSE', dur: '1.8s', dashCls: 'animate-dash-1' },
    { id: 1, x: 160, y: 78,  label: 'EMBED', dur: '2.4s', dashCls: 'animate-dash-2' },
    { id: 2, x: 137, y: 155, label: 'QUERY', dur: '3.0s', dashCls: 'animate-dash-3' },
    { id: 3, x: 63,  y: 155, label: 'INDEX', dur: '2.2s', dashCls: 'animate-dash-4' },
    { id: 4, x: 40,  y: 78,  label: 'LLM',   dur: '2.7s', dashCls: 'animate-dash-5' },
  ]

  return (
    <svg width="160" height="160" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">

      {/* Pentagon ring (node-to-node) */}
      {nodes.map((n, i) => {
        const next = nodes[(i + 1) % nodes.length]
        return (
          <line
            key={`ring-${i}`}
            x1={n.x} y1={n.y} x2={next.x} y2={next.y}
            stroke="#2a2a35" strokeWidth="0.75" strokeDasharray="2 6"
          />
        )
      })}

      {/* Flowing spokes from center to each node */}
      {nodes.map(n => (
        <line
          key={`spoke-${n.id}`}
          x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke="#b9ff66" strokeWidth="0.75" strokeLinecap="round"
          className={n.dashCls}
          opacity="0.4"
        />
      ))}

      {/* Traveling data particles */}
      {nodes.map(n => (
        <circle key={`pt-${n.id}`} r="2.5" fill="#b9ff66" opacity="0.85">
          <animateMotion path={`M${cx},${cy} L${n.x},${n.y}`} dur={n.dur} repeatCount="indefinite" />
        </circle>
      ))}

      {/* Pulsing ring */}
      <circle cx={cx} cy={cy} r="30" fill="none" stroke="#b9ff66" strokeWidth="1" className="animate-ring-pulse" />

      {/* Central hub */}
      <circle cx={cx} cy={cy} r="22" fill="#0a0a0f" stroke="#b9ff66" strokeWidth="1.5" />
      <text x={cx} y={cy - 3} textAnchor="middle" fill="#b9ff66" fontSize="9"
        fontFamily="JetBrains Mono, monospace" fontWeight="500">{'{ }'}</text>
      <text x={cx} y={cy + 9} textAnchor="middle" fill="#3f3f46" fontSize="5.5"
        fontFamily="JetBrains Mono, monospace">REPO</text>

      {/* Satellite nodes */}
      {nodes.map(n => (
        <g key={`node-${n.id}`}>
          <circle cx={n.x} cy={n.y} r="15" fill="#0a0a0f" stroke="#2a2a35" strokeWidth="1" />
          <text x={n.x} y={n.y + 3.5} textAnchor="middle" fill="#52525b" fontSize="5.5"
            fontFamily="JetBrains Mono, monospace">{n.label}</text>
        </g>
      ))}
    </svg>
  )
}

// ── Terminal mock (decorative, right side of hero) ──────────────────────────

function TerminalMock() {
  return (
    <div className="bg-[#050508] border border-[#222] flex flex-col overflow-hidden shadow-2xl w-full max-w-[576px]">
      {/* Terminal header */}
      <div className="bg-[#0a0a0f] border-b border-[#222] h-8 flex items-center justify-between px-4">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full border border-[#222]" />
          <div className="w-2.5 h-2.5 rounded-full border border-[#222]" />
          <div className="w-2.5 h-2.5 rounded-full border border-[#222]" />
        </div>
        <span className="font-mono text-[10px] text-[#52525b] tracking-widest">SESSION: 894F-X92</span>
      </div>

      {/* Terminal body */}
      <div className="p-6 flex flex-col gap-6 relative overflow-hidden">
        {/* Subtle scanline overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.5) 1px, rgba(255,255,255,0.5) 2px)', backgroundSize: '100% 2px' }} />

        {/* User input block */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#71717a]" />
            <span className="font-mono text-[10px] text-[#71717a] tracking-widest uppercase">USER_INPUT</span>
          </div>
          <div className="bg-[#111118] border-l-2 border-[#b9ff66] pl-3.5 pr-3 py-3 font-mono text-xs text-white leading-5">
            Explain how the auth middleware handles JWT expiration in this repo.
          </div>
        </div>

        {/* AI response block */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-2.5 h-2.5 text-[#b9ff66]" />
            <span className="font-mono text-[10px] text-[#b9ff66] tracking-widest uppercase">CODERAG_AI</span>
          </div>
          <div className="flex flex-col gap-3 p-3">
            <p className="font-mono text-xs text-[#a1a1aa] leading-4">
              Based on{' '}
              <span className="text-[#b9ff66]">/src/lib/auth.ts</span>:
            </p>
            <div className="border-l border-[#3f3f46] pl-2.5">
              <p className="font-mono text-xs text-[#a1a1aa] leading-4">
                The middleware uses a secondary grace-period check. If{' '}
                <span className="text-[#ffb59d]">exp</span>
                {' '}is within 300s, it triggers a background refresh via{' '}
                <span className="text-white">renewToken()</span>.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="bg-[#27272a] px-1 font-mono text-[9px] text-[#71717a]">REF: L124</span>
              <span className="bg-[#27272a] px-1 font-mono text-[9px] text-[#71717a]">REF: L142</span>
            </div>
          </div>
        </div>

        {/* Blinking cursor */}
        <div className="flex items-center gap-2">
          <ChevronRight className="w-2 h-2 text-[#b9ff66]" />
          <div className="w-2 h-4 bg-[#b9ff66] animate-cursor-blink" />
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const ingestRepo = useReposStore((s) => s.ingestRepo)

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault()
    if (!url.trim()) { setError('Please enter a GitHub URL.'); return }
    if (!url.includes('github.com')) { setError('URL must be a github.com link.'); return }
    setIsSubmitting(true)
    setError(null)
    try {
      const repoId = await ingestRepo(url.trim())
      navigate(`/chat/${repoId}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative w-full bg-[#0a0a0f] overflow-y-auto h-full">

      {/* ── Top header bar ── */}
      <header className="absolute top-0 left-0 right-0 h-12 bg-[#0a0a0f] border-b border-[#222] flex items-center justify-between px-4 z-20">
        <span className="font-heading font-bold text-[#b9ff66] text-xl tracking-[0.15em] uppercase">
          CODERAG_V1.0
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 border border-[#222] h-8 px-3">
            <GitBranch className="w-3 h-3 text-[#a1a1aa]" />
            <span className="font-mono text-[10px] text-[#a1a1aa] tracking-widest uppercase">BRANCH: MAIN</span>
          </div>
          <div className="bg-[#b9ff66] px-2 py-0.5 rounded-sm">
            <span className="font-heading font-bold text-[#0a0a0f] text-[10px] tracking-tight uppercase">V0.1.0</span>
          </div>
          <button className="p-1.5 text-[#a1a1aa] hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* ── Page content (offset by header) ── */}
      <div className="pt-12 flex flex-col min-h-full">

        {/* ── Hero Section ── */}
        <section className="grid grid-cols-12 min-h-[calc(100vh-48px)]">

          {/* Left: copy + form */}
          <div className="col-span-7 border-r border-[#222] flex flex-col justify-center px-24 py-24">
            {/* Tag */}
            <div className="inline-flex mb-12">
              <div className="border border-[rgba(185,255,102,0.2)] px-2.5 py-1">
                <span className="font-mono text-[#b9ff66] text-sm tracking-[3px] uppercase">[ AI CODE ASSISTANT ]</span>
              </div>
            </div>

            {/* Heading */}
            <div className="flex flex-col gap-0 mb-12 relative">
              <h1 className="font-heading font-normal text-white uppercase leading-none" style={{ fontSize: '84px', lineHeight: '105px' }}>
                UNDERSTAND
              </h1>
              <h1 className="font-heading font-normal uppercase text-outline leading-none" style={{ fontSize: '84px', lineHeight: '105px' }}>
                ANY
              </h1>
              <h1 className="font-heading font-normal uppercase text-outline leading-none" style={{ fontSize: '84px', lineHeight: '105px' }}>
                CODEBASE
              </h1>
              {/* Animated doodle — floats to the right of the heading block */}
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-6 opacity-50 animate-float pointer-events-none select-none">
                <CodeDoodle />
              </div>
            </div>

            {/* Description */}
            <p className="font-body text-[#a1a1aa] text-lg leading-relaxed max-w-[512px] mb-10">
              Chat with any GitHub repository in seconds. CodeRAG indexes your code using deep vector embeddings to provide high-fidelity answers with literal source citations.
            </p>

            {/* URL input + INGEST button */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-[576px]">
              <div className="border border-[#222] flex items-center">
                <div className="bg-[#111118] flex-1 flex items-center gap-3 px-4 py-0">
                  <GitBranch className="w-4 h-4 text-[#71717a] shrink-0" />
                  <input
                    type="url"
                    placeholder="https://github.com/user/repo"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setError(null) }}
                    disabled={isSubmitting}
                    className="flex-1 bg-transparent py-4 font-mono text-sm text-white placeholder:text-[#3f3f46] border-none outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !url.trim()}
                  className="bg-[#b9ff66] hover:bg-[#a8f050] transition-colors px-8 py-5 flex items-center gap-2 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="w-3 h-3 rounded-full border-2 border-[#0a0a0f]/30 border-t-[#0a0a0f] animate-spin" />
                  ) : (
                    <>
                      <span className="font-mono font-bold text-[#0a0a0f] text-sm tracking-tight uppercase">INGEST</span>
                      <ArrowRight className="w-3 h-3 text-[#0a0a0f]" />
                    </>
                  )}
                </button>
              </div>
              {error && (
                <p className="font-mono text-xs text-[#ef4444] animate-reveal-fade">{error}</p>
              )}
            </form>
          </div>

          {/* Right: terminal mock */}
          <div className="col-span-5 bg-[#111118] flex items-center justify-center p-6">
            <TerminalMock />
          </div>
        </section>

        {/* ── Stats Bar ── */}
        <section className="bg-[#0a0a0f] border-t border-[#222] grid grid-cols-3">
          {[
            { label: 'LATENCY_OPTIMIZED', value: '< 60s', unit: 'TO INDEX' },
            { label: 'CONTEXT_PRECISION', value: 'TOP 5', unit: 'CHUNKS RETRIEVED' },
            { label: 'INFERENCE_ENGINE',  value: 'LLAMA 3.3', unit: '70B MODEL' },
          ].map((stat, i) => (
            <div key={stat.label} className={`py-8 px-8 flex flex-col gap-2 ${i < 2 ? 'border-r border-[#222]' : ''}`}>
              <span className="font-mono text-[10px] text-[#71717a] tracking-widest uppercase">{stat.label}</span>
              <div className="flex items-baseline gap-2">
                <span className="font-heading font-normal text-white text-base">{stat.value}</span>
                <span className="font-mono text-xs text-[#52525b]">{stat.unit}</span>
              </div>
            </div>
          ))}
        </section>

        {/* ── Feature Grid ── */}
        <section className="bg-[#0a0a0f] border-t border-[#222] px-8 py-8">
          <div className="grid grid-cols-4 gap-4">

            {/* SEMANTIC MAPPING — spans 2 cols */}
            <div className="col-span-2 bg-[#111118] border border-[#222] p-8 relative overflow-hidden flex flex-col justify-end min-h-[338px]">
              {/* Decorative background icon */}
              <div className="absolute right-8 top-8 opacity-10">
                <Network className="w-36 h-36 text-white" />
              </div>
              <div className="flex flex-col gap-2 relative">
                <Network className="w-8 h-8 text-white mb-4" />
                <h3 className="font-heading text-white text-base uppercase">SEMANTIC MAPPING</h3>
                <p className="font-body text-[#71717a] text-base leading-6 max-w-xs">
                  We don't just find text. We map function calls, dependencies, and logical flows across your entire architecture.
                </p>
              </div>
            </div>

            {/* LOCAL_INDEX */}
            <div className="bg-[#111118] border border-[#222] p-8 flex flex-col justify-between min-h-[338px]">
              <div className="flex-1 flex items-start">
                <Shield className="w-5 h-5 text-[#71717a]" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-mono text-white text-base">LOCAL_INDEX</h3>
                <p className="font-mono text-[#71717a] text-xs leading-4">
                  Your code never leaves your private VPC. Indexing happens locally on encrypted vectors.
                </p>
              </div>
            </div>

            {/* ULTRA_FAST — lime green card */}
            <div className="bg-[#b9ff66] p-8 flex flex-col justify-between min-h-[338px]">
              <div className="flex-1 flex items-start">
                <Zap className="w-5 h-5 text-[#0a0a0f]" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="font-mono font-bold text-[#0a0a0f] text-base">ULTRA_FAST</h3>
                <p className="font-mono font-bold text-[#0a0a0f] text-xs leading-4">
                  Sub-200ms retrieval times using specialized HNSW indexing on edge nodes.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="bg-[#0a0a0f] border-t border-[#222] flex items-center justify-between px-8 py-6 mt-auto">
          <span className="font-mono text-[10px] text-[#52525b] tracking-widest uppercase">
            © 2024 CODERAG SYSTEMS // ALL LOGS ENCRYPTED
          </span>
          <div className="flex gap-8">
            {['RESOURCES', 'DOCUMENTATION', 'API_KEYS'].map((link) => (
              <button key={link} className="font-mono text-[10px] text-[#71717a] hover:text-white transition-colors tracking-widest uppercase">
                {link}
              </button>
            ))}
          </div>
        </footer>

      </div>
    </div>
  )
}
