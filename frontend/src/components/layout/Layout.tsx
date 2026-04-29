import { Outlet, Link } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 font-semibold text-lg hover:text-primary transition-colors"
          >
            <GitBranch className="h-5 w-5" />
            CodeRAG
          </Link>

          <Badge variant="secondary" className="text-xs font-mono">
            Backend: localhost:8000
          </Badge>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t py-4">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-muted-foreground">
          Built with FastAPI + React
        </div>
      </footer>
    </div>
  )
}
