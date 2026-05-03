import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onCitationClick: (filePath: string, startLine: number, endLine: number) => void
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-[#b9ff66]">{'>'}</span>
      <div className="flex items-end gap-0.5 h-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-0.5 bg-[#b9ff66] animate-pulse"
            style={{ height: '8px', animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="font-mono text-xs text-[#71717a] animate-pulse">PROCESSING...</span>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-start justify-center h-full px-6 gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-sm text-[#a1a1aa]">{'>'} SYSTEM READY</p>
        <p className="font-mono text-xs text-[#52525b]">Ask anything about this codebase to begin.</p>
      </div>
      <div className="flex flex-col gap-1 opacity-40">
        {[
          '"What does the main entry point do?"',
          '"How is authentication implemented?"',
          '"Show me the error handling logic"',
        ].map((prompt) => (
          <p key={prompt} className="font-mono text-xs text-[#71717a] italic">{prompt}</p>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <div className="w-2 h-4 bg-[#b9ff66] animate-cursor-blink" />
      </div>
    </div>
  )
}

export function MessageList({ messages, isStreaming, onCitationClick }: MessageListProps) {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const lastContent = messages[messages.length - 1]?.content

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distFromBottom < 200) el.scrollTop = el.scrollHeight
  }, [messages.length, lastContent])

  const lastMessage = messages[messages.length - 1]
  const showThinking = isStreaming && lastMessage?.role === 'assistant' && lastMessage.content === ''

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-8 max-w-[768px]">
          {messages.map((msg, i) => (
            <MessageBubble key={i} message={msg} onCitationClick={onCitationClick} />
          ))}
          {showThinking && <ThinkingIndicator />}
          {/* Blinking cursor at end */}
          {!showThinking && (
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-4 bg-[#b9ff66] animate-cursor-blink" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
