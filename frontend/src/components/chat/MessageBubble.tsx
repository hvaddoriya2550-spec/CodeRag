import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import type { Components } from 'react-markdown'
import type { ChatMessage, ChunkSource } from '@/types'
import { SourceCard } from './SourceCard'

// Custom dark syntax theme matching the Figma terminal palette
const coderagTheme: { [key: string]: React.CSSProperties } = {
  'code[class*="language-"]': { color: '#e0e4d4', background: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', lineHeight: '1.5' },
  'pre[class*="language-"]':  { color: '#e0e4d4', background: '#0a0a0f', fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', lineHeight: '1.5', margin: 0, padding: '16px', border: '1px solid #222' },
  'keyword':  { color: '#ffb59d' },
  'function': { color: '#a4c8ff' },
  'string':   { color: '#ffddd2' },
  'comment':  { color: '#52525b', fontStyle: 'italic' },
  'number':   { color: '#b9ff66' },
  'class-name': { color: '#b9ff66' },
  'boolean':  { color: '#ffb59d' },
  'operator': { color: '#a1a1aa' },
  'punctuation': { color: '#71717a' },
}

function processCitations(
  node: React.ReactNode,
  onClick: (f: string, s: number, e: number) => void,
): React.ReactNode {
  if (typeof node === 'string') {
    const re = /\[([^:\]]+):(\d+)-(\d+)\]/g
    const parts: React.ReactNode[] = []
    let lastIndex = 0, match: RegExpExecArray | null
    while ((match = re.exec(node)) !== null) {
      if (match.index > lastIndex) parts.push(node.slice(lastIndex, match.index))
      const [, filePath, s, e] = match
      parts.push(
        <button
          key={`cite-${match.index}`}
          onClick={() => onClick(filePath, parseInt(s, 10), parseInt(e, 10))}
          className="inline-flex items-center font-mono text-[12px] underline decoration-[rgba(185,255,102,0.3)] text-[#b9ff66] hover:text-white transition-colors"
        >
          [{filePath}:{s}-{e}]
        </button>
      )
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < node.length) parts.push(node.slice(lastIndex))
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

function AssistantBubble({ message, onCitationClick }: { message: ChatMessage; onCitationClick: (f: string, s: number, e: number) => void }) {
  const components: Components = {
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      const match = /language-(\w+)/.exec(className || '')
      if (!match) {
        return <code className="bg-[#27272a] px-1 py-0.5 font-mono text-xs text-[#b9ff66]">{children}</code>
      }
      return (
        <SyntaxHighlighter language={match[1]} style={coderagTheme as never} PreTag="div">
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      )
    },
    p: ({ children }) => (
      <p className="font-body text-sm text-white leading-[22.75px] mb-2 last:mb-0">
        {processCitations(children, onCitationClick)}
      </p>
    ),
    ul: ({ children }) => <ul className="mb-2 ml-4 list-none space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
    li: ({ children }) => <li className="font-body text-sm text-white leading-relaxed before:content-['—'] before:mr-2 before:text-[#b9ff66]">{children}</li>,
    h1: ({ children }) => <h1 className="font-mono font-bold text-base text-white mb-2 mt-3 uppercase">{children}</h1>,
    h2: ({ children }) => <h2 className="font-mono font-bold text-sm text-white mb-2 mt-3 uppercase">{children}</h2>,
    h3: ({ children }) => <h3 className="font-mono text-xs text-[#a1a1aa] mb-1 mt-2 uppercase">{children}</h3>,
    table: ({ children }) => (
      <div className="overflow-x-auto mb-2">
        <table className="font-mono text-xs border-collapse w-full">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border border-[#222] px-3 py-1.5 text-left font-bold text-[#a1a1aa] bg-[#111118]">{children}</th>,
    td: ({ children }) => <td className="border border-[#222] px-3 py-1.5 text-white">{children}</td>,
  }

  const hasSources = message.sources && message.sources.length > 0

  return (
    <div className="flex flex-col gap-4 max-w-[768px]">
      <div className="text-sm">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {message.content}
        </ReactMarkdown>
      </div>
      {hasSources && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            {(message.sources as ChunkSource[]).map((source) => (
              <SourceCard
                key={source.chunk_id}
                source={source}
                onClick={() => onCitationClick(source.file_path, source.start_line, source.end_line)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function MessageBubble({ message, onCitationClick }: {
  message: ChatMessage
  onCitationClick: (filePath: string, startLine: number, endLine: number) => void
}) {
  if (message.role === 'user') {
    return (
      <div className="max-w-[768px]">
        <p className="font-mono text-sm text-[#b9ff66] leading-[22.75px] whitespace-pre-wrap break-words">
          <span className="mr-2">{'>'}</span>
          {message.content}
        </p>
      </div>
    )
  }
  return <AssistantBubble message={message} onCitationClick={onCitationClick} />
}
