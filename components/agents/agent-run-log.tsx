'use client'

import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'

interface AgentRun {
  id: string
  trigger: string
  status: string
  summary: string | null
  started_at: string
  finished_at: string | null
}

export function AgentRunLog({ runs }: { runs: AgentRun[] }) {
  const statusColor = (s: string) =>
    s === 'completed' ? 'text-green-400' : s === 'failed' ? 'text-red-400' : 'text-yellow-400'

  return (
    <div className="space-y-2">
      {runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No runs yet.</p>
      ) : runs.map(run => (
        <div key={run.id} className="flex items-start gap-3 text-sm border border-border rounded-lg p-3">
          <span className={`font-medium ${statusColor(run.status)} w-20 flex-shrink-0`}>
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
