'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgentRuns } from '@/hooks/use-agent-runs'
import { useAgentRunsRealtime } from '@/hooks/use-realtime'
import { format } from 'date-fns'

const STATUS_STYLES: Record<string, string> = {
  completed: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-yellow-400',
  triggered: 'text-sky-400',
}

export function AgentRunLog() {
  const { runs, isLoading, error, refetch } = useAgentRuns()
  useAgentRunsRealtime()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <p>Failed to load run log: {(error as Error).message}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      ) : runs.map(run => (
        <div key={run.id} className="flex items-start gap-3 text-sm border border-border rounded-lg p-3">
          <span className={`font-medium ${STATUS_STYLES[run.status] ?? 'text-muted-foreground'} w-20 flex-shrink-0`}>
            {run.status}
          </span>
          <div className="flex-1 min-w-0">
            {run.summary && <p className="text-foreground truncate">{run.summary}</p>}
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(new Date(run.started_at), 'MM/dd HH:mm')}
              {' · '}
              <Badge variant="outline" className="text-xs py-0">{run.trigger}</Badge>
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
