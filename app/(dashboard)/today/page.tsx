'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Bot, CalendarCheck, CalendarDays, UserRound } from 'lucide-react'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { getTaskStatusDotColor, getTaskStatusLabel } from '@/lib/task-status'
import { getTaskReadiness, TASK_READINESS_STYLES } from '@/lib/task-readiness'
import { useTodayRealtime } from '@/hooks/use-realtime'

interface TodayTask {
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

export default function TodayPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const supabase = createClient()
  useTodayRealtime()

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['today-tasks', todayStr],
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
        .not('due_date', 'is', null)
        .lte('due_date', todayStr)
        .is('parent_task_id', null)
        .order('due_date', { ascending: true })

      if (error) throw error
      return (data ?? []) as TodayTask[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const dueRank = (a.due_date ?? '').localeCompare(b.due_date ?? '')
      if (dueRank !== 0) return dueRank
      return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
    })
  }, [tasks])

  const overdueCount = tasks.filter(task => (task.due_date ?? '') < todayStr).length
  const dueTodayCount = tasks.length - overdueCount

  const selectedTask = tasks.find(task => task.id === selectedTaskId)

  return (
    <div className="flex h-full">
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <CalendarCheck size={20} className="text-primary" />
                Today
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tasks due today or overdue, across all projects.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {overdueCount > 0 && (
                <Badge variant="outline" className="border-rose-500/50 px-2.5 py-1 text-rose-500">
                  {overdueCount} overdue
                </Badge>
              )}
              <Badge variant="outline" className="px-2.5 py-1">{dueTodayCount} due today</Badge>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              Failed to load today&apos;s tasks: {(error as Error).message}
            </div>
          ) : isLoading ? (
            <div className="rounded-lg border border-border bg-card/60 p-6 text-sm text-muted-foreground">
              Loading today&apos;s tasks...
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="rounded-lg border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
              Nothing due today. Enjoy the clear runway.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card/70">
              <div className="hidden grid-cols-[minmax(0,1fr)_144px_96px_124px_112px] border-b border-border bg-background/45 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid">
                <span>Task</span>
                <span>Project</span>
                <span>Status</span>
                <span>Assignee</span>
                <span>Due</span>
              </div>
              {sortedTasks.map(task => {
                const readiness = getTaskReadiness(task)
                const isOverdue = (task.due_date ?? '') < todayStr
                return (
                  <button
                    key={task.id}
                    type="button"
                    className="grid w-full grid-cols-1 gap-1.5 border-b border-border/50 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-secondary/35 md:grid-cols-[minmax(0,1fr)_144px_96px_124px_112px] md:items-center"
                    onClick={() => setSelectedTaskId(task.id)}
                  >
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
                    <span className={cn(
                      'flex items-center gap-1 text-xs',
                      isOverdue ? 'font-medium text-rose-500' : 'text-muted-foreground'
                    )}>
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
