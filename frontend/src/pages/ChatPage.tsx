import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useReposStore } from '@/store/reposStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function ChatPage() {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()

  const repo = useReposStore((s) => (repoId ? s.getRepoById(repoId) : undefined))
  const loadRepos = useReposStore((s) => s.loadRepos)
  const selectRepo = useReposStore((s) => s.selectRepo)

  useEffect(() => {
    if (repoId) selectRepo(repoId)
    loadRepos()
  }, [repoId, loadRepos, selectRepo])

  if (!repoId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-112px)] gap-4">
        <p className="text-muted-foreground">No repository specified.</p>
        <Button variant="outline" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-[280px_1fr] gap-4 h-[calc(100vh-120px)]">
        {/* Left: repo sidebar placeholder */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Repo Sidebar
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center">
              Full sidebar coming in Week 6
            </p>
          </CardContent>
        </Card>

        {/* Right: chat area placeholder */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">
              {repo?.name ?? repoId}
            </CardTitle>
            <Badge variant="secondary">
              {repo?.status ?? 'loading…'}
            </Badge>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Chat UI coming in Week 6
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
