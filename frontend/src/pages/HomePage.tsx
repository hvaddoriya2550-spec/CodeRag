import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReposStore } from '@/store/reposStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const EXAMPLES = [
  'https://github.com/psf/requests',
  'https://github.com/tiangolo/fastapi',
  'https://github.com/encode/httpx',
]

export default function HomePage() {
  const [url, setUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const navigate = useNavigate()
  const ingestRepo = useReposStore((s) => s.ingestRepo)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!url.trim()) {
      setError('Please enter a GitHub URL.')
      return
    }
    if (!url.includes('github.com')) {
      setError('URL must be a github.com link.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const repoId = await ingestRepo(url.trim())
      navigate(`/chat/${repoId}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-112px)] px-4 py-12">
      <div className="w-full max-w-2xl space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            Ask Questions About Any Codebase
          </h1>
          <p className="text-muted-foreground text-lg">
            Paste a public GitHub repo and chat with its code.
          </p>
        </div>

        {/* Form card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ingest a Repository</CardTitle>
            <CardDescription>
              We'll clone, parse, and embed it — usually under a minute.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                type="url"
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isSubmitting}
                className="font-mono text-sm"
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Ingesting…' : 'Ingest Repository'}
              </Button>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Example links */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center font-medium uppercase tracking-wide">
            Examples
          </p>
          <div className="flex flex-col items-center gap-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setUrl(ex)}
                className="text-sm text-primary hover:underline font-mono"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
