import { useEffect, useRef, useState } from 'react'
import { FileCode, Loader2, X } from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import * as api from '@/lib/api'

interface CodeViewerProps {
  repoId: string
  filePath: string | null
  highlightRange: { start: number; end: number } | null
  onClose?: () => void
}

export function CodeViewer({ repoId, filePath, highlightRange, onClose }: CodeViewerProps) {
  const [content, setContent] = useState<string>('')
  const [language, setLanguage] = useState<string>('text')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-fetch whenever the selected file changes. Files served by this endpoint
  // are capped at 1 MB and served from local disk, so the round-trip is fast
  // enough that caching adds more complexity than it saves.
  useEffect(() => {
    if (!filePath) return
    setIsLoading(true)
    setError(null)
    api
      .getFileContent(repoId, filePath)
      .then((data) => {
        setContent(data.content)
        setLanguage(data.language)
      })
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setIsLoading(false))
  }, [repoId, filePath])

  // Scroll to the highlighted range whenever the range or content changes.
  // react-syntax-highlighter doesn't expose per-line DOM refs, so we calculate
  // a Y offset from the line number and a fixed line height. At ~22px per line
  // this is accurate enough that the highlighted block lands on screen; the
  // ±5 line buffer ensures the highlighted line isn't flush with the top edge.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!highlightRange || !content) return
    const container = scrollContainerRef.current
    if (!container) return
    const LINE_HEIGHT_PX = 22
    const targetY = Math.max(0, (highlightRange.start - 5) * LINE_HEIGHT_PX)
    container.scrollTo({ top: targetY, behavior: 'smooth' })
  }, [highlightRange, content])

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <FileCode className="h-10 w-10 opacity-30" />
        <p className="text-sm">Click a citation to view the code</p>
      </div>
    )
  }

  // ── Header (always rendered when filePath is set) ────────────────────────────
  const header = (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-3 py-2 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs truncate text-foreground">{filePath}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close file viewer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  // ── Loading state ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {header}
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    )
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="h-full flex flex-col">
        {header}
        <div className="flex flex-1 items-center justify-center px-4">
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      </div>
    )
  }

  // ── Code view ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {header}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          showLineNumbers
          wrapLines
          lineProps={(lineNumber: number) => {
            const isHighlighted =
              highlightRange != null &&
              lineNumber >= highlightRange.start &&
              lineNumber <= highlightRange.end
            return {
              style: {
                display: 'block',
                width: '100%',
                backgroundColor: isHighlighted ? 'rgba(250, 204, 21, 0.10)' : 'transparent',
                borderLeft: isHighlighted
                  ? '3px solid rgb(250, 204, 21)'
                  : '3px solid transparent',
              },
            }
          }}
          customStyle={{ margin: 0, borderRadius: 0, minHeight: '100%', fontSize: '0.8rem' }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
