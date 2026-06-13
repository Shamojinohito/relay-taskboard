'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, isBefore, addDays, parseISO } from 'date-fns'
import { AlertTriangle, Bot, CalendarDays, Inbox, UserRound } from 'lucide-react'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { getTaskStatusDotColor, getTaskStatusLabel } from '@/lib/task-status'
import { getTaskReadiness, TASK_READINESS_STYLES } from '@/lib/task-readiness'

interface InboxTask {
  id: string
  project_id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  handoff_note: string | null
  blocked_reason: string | null
  assignee_user_id: string | null
  assignee_agent_id: string | null
  project: { name: string } | null
  task_tags: { tags: { id: string; name: string; color: string } | null }[]
  assignee_agent: { name: string; type: string } | null
}

const PRIORITY_RANK: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function isDueSoon(dueDate: string | null) {
  if (!dueDate) return false
  return isBefore(parseISO(dueDate), addDays(new Date(), 3))
}

function hasAssignee(task: InboxTask) {
  return Boolean(task.assignee_user_id || task.assignee_agent_id)
}

function getTriageReason(task: InboxTask) {
  if (task.status === 'blocked') return 'Blocked'
  if (!hasAssignee(task)) return 'Unassigned'
  if (!task.handoff_note?.trim()) return 'No handoff'
  if (isDueSoon(task.due_date)) return 'Due soon'
  if (task.status === 'in_review') return 'Needs review'
  return 'Watch'
}

export default function InboxPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const supabase = createClient()

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['triage-inbox'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('tasks') as any)
        .select(`
          id,
          project_id,
          title,
          status,
          priority,
          due_date,
          handoff_note,
          blocked_reason,
          assignee_user_id,
          assignee_agent_id,
          project:project_id(name),
          task_tags(tag_id, tags(id, name, color)),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .neq('status', 'done')
        .is('parent_task_id', null)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as InboxTask[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const triageTasks = useMemo(() => {
    return [...tasks]
      .filter(task =>
        task.status === 'blocked' ||
        task.status === 'in_review' ||
        !hasAssignee(task) ||
        !task.handoff_note?.trim() ||
        isDueSoon(task.due_date)
      )
      .sort((a, b) => {
        const reasonRank = getTriageReason(a).localeCompare(getTriageReason(b))
        if (reasonRank !== 0) return reasonRank
        return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
      })
  }, [tasks])

  const counts = {
    blocked: tasks.filter(task => task.status === 'blocked').length,
    unassigned: tasks.filter(task => !hasAssignee(task)).length,
    noHandoff: tasks.filter(task => !task.handoff_note?.trim()).length,
    dueSoon: tasks.filter(task => isDueSoon(task.due_date)).length,
    review: tasks.filter(task => task.status === 'in_review').length,
  }

  const selectedTask = tasks.find(task => task.id === selectedTaskId)

  return (
    <div className="flex h-full">
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Inbox size={20} className="text-primary" />
                Inbox
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Triage tasks that need context, ownership, human review, or unblock decisions.
              </p>
            </div>
            <Badge variant="outline" className="px-2.5 py-1">{triageTasks.length} signals</Badge>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-5">
            {[
              ['Blocked', counts.blocked, 'bg-rose-500'],
              ['Unassigned', counts.unassigned, 'bg-sky-400'],
              ['No Handoff', counts.noHandoff, 'bg-amber-400'],
              ['Due Soon', counts.dueSoon, 'bg-violet-400'],
              ['Review', counts.review, 'bg-emerald-400'],
            ].map(([label, count, color]) => (
              <div key={label} className="rounded-lg border border-border bg-card/70 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn('size-2 rounded-full', color as string)} />
                  {label}
                </div>
                <div className="mt-1 text-xl font-semibold">{count}</div>
              </div>
            ))}
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load inbox: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="rounded-lg border border-border bg-card/60 p-6 text-sm text-muted-foreground">
              Loading inbox...
            </div>
          ) : triageTasks.length === 0 ? (
            <div className="rounded-lg border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
              No triage signals. The board is in a clean state.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card/70">
              <div className="hidden grid-cols-[112px_minmax(0,1fr)_144px_96px_124px_112px] border-b border-border bg-background/45 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid">
                <span>Reason</span>
                <span>Task</span>
                <span>Project</span>
                <span>Status</span>
                <span>Assignee</span>
                <span>Due</span>
              </div>
              {triageTasks.map(task => {
                const readiness = getTaskReadiness(task)
                return (
                  <button
                    key={task.id}
                    type="button"
                    className="grid w-full grid-cols-1 gap-1.5 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-secondary/35 md:grid-cols-[112px_minmax(0,1fr)_144px_96px_124px_112px] md:items-center"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-background/55 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      <AlertTriangle size={11} />
                      {getTriageReason(task)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cn('size-2 rounded-full', TASK_READINESS_STYLES[readiness.level])} title={readiness.title} />
                        <span className="truncate text-sm font-medium text-foreground">{task.title}</span>
                      </span>
                      {task.task_tags.length > 0 && (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {task.task_tags.slice(0, 2).map(({ tags }) => tags && (
                            <span key={tags.id} className="rounded border px-1 py-0.5 text-[9px]" style={{ borderColor: tags.color, color: tags.color }}>
                              {tags.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{task.project?.name ?? 'No project'}</span>
                    <span className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn('size-2 rounded-full', getTaskStatusDotColor(task.status))} />
                      {getTaskStatusLabel(task.status)}
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      {task.assignee_agent_id ? <Bot size={12} /> : task.assignee_user_id ? <UserRound size={12} /> : null}
                      <span className="truncate">{task.assignee_agent?.name ?? (task.assignee_user_id ? 'Human' : 'None')}</span>
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays size={12} />
                      {task.due_date ? format(parseISO(task.due_date), 'yyyy.MM.dd') : 'No due'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </main>

      {selectedTaskId && selectedTask && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={selectedTask.project_id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}
