import { useEffect, useRef } from 'react'
import { MessageSquare } from 'lucide-react'
import type { ChatMessage } from '@/types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onCitationClick: (filePath: string, startLine: number, endLine: number) => void
}

function ThinkingIndicator() {
  return (
    <div className="max-w-[90%] mr-auto">
      <div className="rounded-2xl rounded-tl-sm bg-muted px-4 py-3 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
      <MessageSquare className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="text-lg font-semibold text-foreground">Ask anything about this codebase</p>
        <p className="text-sm text-muted-foreground mt-1">Try one of these to get started:</p>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1">
        <li className="italic">"What does the main entry point do?"</li>
        <li className="italic">"How is authentication implemented?"</li>
        <li className="italic">"Show me the error handling logic"</li>
      </ul>
    </div>
  )
}

export function MessageList({ messages, isStreaming, onCitationClick }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastContent = messages[messages.length - 1]?.content

  // Re-runs on every new message and on every streamed token appended to the
  // last message. Only scrolls when the user is already near the bottom — if
  // they scrolled up to re-read something, we leave them there.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages.length, lastContent])

  const lastMessage = messages[messages.length - 1]
  const showThinking =
    isStreaming && lastMessage?.role === 'assistant' && lastMessage.content === ''

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            // Index key is safe here: messages are strictly append-only.
            // We never delete or reorder, so React's reconciliation won't
            // mismatch DOM nodes and produce ghost state.
            <MessageBubble key={i} message={msg} onCitationClick={onCitationClick} />
          ))}
          {showThinking && <ThinkingIndicator />}
        </div>
      )}
    </div>
  )
}
