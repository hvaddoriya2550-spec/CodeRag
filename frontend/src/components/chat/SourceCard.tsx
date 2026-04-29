import { FileCode } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ChunkSource } from '@/types'

interface SourceCardProps {
  source: ChunkSource
  onClick: () => void
}

export function SourceCard({ source, onClick }: SourceCardProps) {
  return (
    <button
      onClick={onClick}
      className="p-3 border rounded-lg hover:border-primary transition-colors cursor-pointer text-left w-full"
    >
      <div className="flex items-center gap-1.5 mb-1 min-w-0">
        <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs truncate text-foreground">
          {source.file_path}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium truncate">{source.name}</span>
        <Badge variant="secondary" className="shrink-0">
          {source.chunk_type}
        </Badge>
        <span className="shrink-0">
          Lines {source.start_line}–{source.end_line}
        </span>
      </div>
    </button>
  )
}
