import type { ChunkSource } from '@/types'
import { ExternalLink } from 'lucide-react'

interface SourceCardProps {
  source: ChunkSource
  onClick: () => void
}

export function SourceCard({ source, onClick }: SourceCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-[#111118] border border-[#222] p-3 flex flex-col gap-1 hover:border-[#444] transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-[#71717a] truncate">{source.file_path}</span>
        <ExternalLink className="w-2.5 h-2.5 text-[#52525b] shrink-0 ml-2" />
      </div>
      <p className="font-mono text-xs text-[#d4d4d8] truncate">{source.name}</p>
      <span className="font-mono text-[10px] text-[#71717a] uppercase">LINES {source.start_line}–{source.end_line}</span>
    </button>
  )
}
