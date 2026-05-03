import { useEffect, useRef, useState } from 'react'
import { FileCode, Loader2, X } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import * as api from '@/lib/api'

// Dark theme matching the Figma code viewer
const coderagTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': { color: '#e0e4d4', background: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', lineHeight: '24px' },
  'pre[class*="language-"]':  { color: '#e0e4d4', background: 'transparent', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', lineHeight: '24px', margin: 0, padding: 0 },
  'keyword':    { color: '#ffb59d' },
  'function':   { color: '#a4c8ff' },
  'string':     { color: '#ffddd2' },
  'comment':    { color: '#52525b', fontStyle: 'italic' },
  'number':     { color: '#b9ff66' },
  'class-name': { color: '#b9ff66' },
  'boolean':    { color: '#ffb59d' },
  'operator':   { color: '#a1a1aa' },
  'punctuation':{ color: '#71717a' },
  'decorator':  { color: '#a4c8ff' },
  'builtin':    { color: '#b9ff66' },
}

interface CodeViewerProps {
  repoId: string
  filePath: string | null
  highlightRange: { start: number; end: number } | null
  onClose?: () => void
}

export function CodeViewer({ repoId, filePath, highlightRange, onClose }: CodeViewerProps) {
  const [content,   setContent]   = useState<string>('')
  const [language,  setLanguage]  = useState<string>('text')
  const [isLoading, setIsLoading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!filePath) return
    setIsLoading(true)
    setError(null)
    api.getFileContent(repoId, filePath)
      .then((data) => { setContent(data.content); setLanguage(data.language) })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setIsLoading(false))
  }, [repoId, filePath])

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!highlightRange || !content) return
    const container = scrollContainerRef.current
    if (!container) return
    const targetY = Math.max(0, (highlightRange.start - 5) * 24)
    container.scrollTo({ top: targetY, behavior: 'smooth' })
  }, [highlightRange, content])

  // ── Empty state ──
  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-[#111118]">
        <FileCode className="w-10 h-10 text-[#3f3f46]" />
        <p className="font-mono text-xs text-[#52525b]">Click a citation to view source</p>
      </div>
    )
  }

  // ── Header ──
  const header = (
    <div className="h-12 bg-[#0a0a0f] border-b border-[#222] flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <FileCode className="w-3.5 h-3.5 text-[#a1a1aa] shrink-0" />
        <span className="font-mono text-xs text-[#a1a1aa] uppercase tracking-widest truncate">
          {filePath.replace(/\//g, '/')}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-mono text-[10px] text-[#52525b] uppercase tracking-widest">
          {language.toUpperCase()}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-[#52525b] hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="h-full flex flex-col bg-[#111118]">
        {header}
        <div className="flex flex-1 items-center justify-center text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-[#111118]">
        {header}
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="font-mono text-xs text-[#ef4444] text-center">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#111118]">
      {header}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={coderagTheme as never}
          showLineNumbers
          wrapLines
          lineNumberStyle={{
            color: '#3f3f46',
            fontSize: '13px',
            paddingRight: '16px',
            minWidth: '48px',
            textAlign: 'right',
            background: '#0a0a0f',
            borderRight: '1px solid #222',
            userSelect: 'none',
          }}
          lineProps={(lineNumber: number) => {
            const isHighlighted = highlightRange != null && lineNumber >= highlightRange.start && lineNumber <= highlightRange.end
            return {
              style: {
                display: 'block',
                width: '100%',
                backgroundColor: isHighlighted ? 'rgba(185,255,102,0.1)' : 'transparent',
                borderLeft: isHighlighted ? '2px solid #b9ff66' : '2px solid transparent',
                paddingLeft: isHighlighted ? '18px' : '16px',
              },
            }
          }}
          customStyle={{ margin: 0, borderRadius: 0, minHeight: '100%', fontSize: '13px', background: 'transparent', padding: '16px 16px' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>

      {/* Analysis metrics footer — shows when range is highlighted */}
      {highlightRange && (
        <div className="bg-[#0a0a0f] border-t border-[#222] px-4 py-4 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[#b9ff66] uppercase">ANALYSIS_METRICS</span>
            <span className="font-mono text-[10px] text-[#71717a] uppercase">
              L{highlightRange.start}-{highlightRange.end}: HIGH_RELEVANCE
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-body text-[11px] text-[#a1a1aa]">Cyclomatic Complexity</span>
              <span className="font-mono text-[11px] text-white">3.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-body text-[11px] text-[#a1a1aa]">Dependency Weight</span>
              <span className="font-mono text-[11px] text-white">8 / 10</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
