import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Components } from 'react-markdown'
import type { ChatMessage, ChunkSource } from '@/types'
import { SourceCard } from './SourceCard'

interface MessageBubbleProps {
  message: ChatMessage
  onCitationClick: (filePath: string, startLine: number, endLine: number) => void
}

// Walks a ReactNode tree, finds [file:start-end] citation patterns inside
// string leaves, and replaces them with clickable buttons. Non-string nodes
// (React elements, numbers, etc.) are returned unchanged.
function processCitations(
  node: React.ReactNode,
  onClick: (filePath: string, startLine: number, endLine: number) => void,
): React.ReactNode {
  if (typeof node === 'string') {
    const re = /\[([^:\]]+):(\d+)-(\d+)\]/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = re.exec(node)) !== null) {
      if (match.index > lastIndex) {
        parts.push(node.slice(lastIndex, match.index))
      }
      const [, filePath, startStr, endStr] = match
      parts.push(
        <button
          key={`cite-${match.index}`}
          onClick={() => onClick(filePath, parseInt(startStr, 10), parseInt(endStr, 10))}
          className="inline-flex items-center gap-1 text-xs font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded hover:bg-primary/20 transition-colors"
        >
          {filePath}:{startStr}–{endStr}
        </button>,
      )
      lastIndex = match.index + match[0].length
    }

    if (lastIndex < node.length) {
      parts.push(node.slice(lastIndex))
    }

    return parts.length > 0 ? parts : node
  }

  if (Array.isArray(node)) {
    return node.map((child, i) =>
      typeof child === 'string'
        ? <React.Fragment key={i}>{processCitations(child, onClick)}</React.Fragment>
        : child,
    )
  }

  return node
}

function AssistantBubble({
  message,
  onCitationClick,
}: {
  message: ChatMessage
  onCitationClick: (filePath: string, startLine: number, endLine: number) => void
}) {
  const components: Components = {
    // Strip the outer <pre> — SyntaxHighlighter renders its own container.
    pre: ({ children }) => <>{children}</>,

    code: ({ className, children }) => {
      const match = /language-(\w+)/.exec(className || '')
      if (!match) {
        return (
          <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">
            {children}
          </code>
        )
      }
      return (
        <SyntaxHighlighter language={match[1]} style={oneDark} PreTag="div">
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      )
    },

    // Intercept paragraph children to detect and render citation buttons.
    p: ({ children }) => (
      <p className="mb-2 last:mb-0 leading-relaxed">
        {processCitations(children, onCitationClick)}
      </p>
    ),

    ul: ({ children }) => (
      <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,

    h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-3">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2">{children}</h3>,

    table: ({ children }) => (
      <div className="overflow-x-auto mb-2">
        <table className="text-sm border-collapse w-full">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border px-3 py-1.5 text-left font-semibold bg-muted">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border px-3 py-1.5">{children}</td>
    ),
  }

  const hasSources = message.sources && message.sources.length > 0

  return (
    <div className="max-w-[90%] mr-auto">
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {message.content}
        </ReactMarkdown>
      </div>

      {hasSources && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1.5 px-1">Sources</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(message.sources as ChunkSource[]).map((source) => (
              <SourceCard
                key={source.chunk_id}
                source={source}
                onClick={() =>
                  onCitationClick(source.file_path, source.start_line, source.end_line)
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function MessageBubble({ message, onCitationClick }: MessageBubbleProps) {
  if (message.role === 'user') {
    return (
      <div className="max-w-[80%] ml-auto">
        <div className="rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2 text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <AssistantBubble message={message} onCitationClick={onCitationClick} />
  )
}
