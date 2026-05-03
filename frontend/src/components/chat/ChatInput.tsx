import { useEffect, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { textareaRef.current?.focus() }, [])

  function handleSubmit() {
    const trimmed = input.trim()
    if (!trimmed) return
    onSend(trimmed)
    setInput('')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  return (
    <div className="bg-[#0a0a0f] border-t border-[#222] flex flex-col gap-2 px-6 pt-6 pb-6 shrink-0">
      <div className={`bg-[#111118] border flex items-center transition-colors ${disabled ? 'border-[#222]' : 'border-[#b9ff66] shadow-[0_0_8px_rgba(185,255,102,0.05)]'}`}>
        <div className="flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="ASK_ROOT_SYSTEM..."
            rows={1}
            className="w-full bg-transparent px-4 py-3.5 font-mono text-sm text-white placeholder:text-[#3f3f46] border-none outline-none resize-none"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          className="w-10 h-10 bg-[#b9ff66] hover:bg-[#a8f050] shrink-0 flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed m-[5px]"
        >
          <ArrowRight className="w-4 h-4 text-[#0a0a0f]" />
        </button>
      </div>
      <div className="flex items-center justify-between px-1">
        <span className="font-mono text-[9px] text-[#52525b] tracking-wide uppercase">ENCRYPTION: AES-256-GCM</span>
        <span className="font-mono text-[9px] text-[#52525b] tracking-wide uppercase">MODEL: RAG-ENGINE-V4-O</span>
      </div>
    </div>
  )
}
