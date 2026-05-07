import { useEffect, useState } from 'react'
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen, Loader2 } from 'lucide-react'
import type { TreeNode } from '@/types'
import * as api from '@/lib/api'

interface FileTreeProps {
  repoId: string
  onFileClick: (path: string) => void
}

interface NodeRowProps {
  node: TreeNode
  depth: number
  onFileClick: (path: string) => void
}

function NodeRow({ node, depth, onFileClick }: NodeRowProps) {
  const [open, setOpen] = useState(depth === 0)

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          className="w-full flex items-center gap-1.5 py-1 pr-2 text-left hover:bg-[#0a0a0f]/60 transition-colors group"
        >
          <span className="text-[#52525b] shrink-0">
            {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </span>
          {open
            ? <FolderOpen className="w-3.5 h-3.5 text-[#b9ff66] shrink-0" />
            : <Folder className="w-3.5 h-3.5 text-[#71717a] shrink-0" />}
          <span className="font-mono text-[11px] text-[#a1a1aa] truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <NodeRow key={child.path} node={child} depth={depth + 1} onFileClick={onFileClick} />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => node.viewable && onFileClick(node.path)}
      style={{ paddingLeft: `${depth * 12 + 8 + 16}px` }}
      className={`w-full flex items-center gap-1.5 py-1 pr-2 text-left transition-colors
        ${node.viewable
          ? 'hover:bg-[#0a0a0f]/60 cursor-pointer'
          : 'cursor-default opacity-40'}`}
    >
      <FileCode className="w-3.5 h-3.5 text-[#52525b] shrink-0" />
      <span className={`font-mono text-[11px] truncate ${node.viewable ? 'text-[#a1a1aa]' : 'text-[#52525b]'}`}>
        {node.name}
      </span>
    </button>
  )
}

export function FileTree({ repoId, onFileClick }: FileTreeProps) {
  const [tree, setTree] = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.getRepoTree(repoId)
      .then((data) => setTree(data.tree))
      .catch((e: unknown) => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [repoId])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-[#71717a]">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="font-mono text-[10px] text-[#ef4444] text-center">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {tree.map((node) => (
        <NodeRow key={node.path || node.name} node={node} depth={0} onFileClick={onFileClick} />
      ))}
    </div>
  )
}
