'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowDown, ArrowUp, Bot, CalendarDays, CheckSquare, LinkIcon, UserRound } from 'lucide-react'
import { sortTasks, type SortDirection, type TaskSortKey } from '@/lib/task-sort'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { TASK_STATUSES, getTaskStatusDotColor, getTaskStatusLabel } from '@/lib/task-status'

interface Task {
  id: string
  title: string
  priority: string
  due_date: string | null
  status: string
  project_id: string
  assignee_user_id: string | null
  assignee_agent_id: string | null
  project: { name: string } | null
  task_tags: { tags: { id: string; name: string; color: string } | null }[]
  task_links: { id: string; url: string; title: string | null }[]
  assignee_agent: { name: string; type: string } | null
}

const STATUS_ORDER = TASK_STATUSES.filter(status => status !== 'done')

const PRIORITY_STYLES: Record<string, string> = {
  low: 'border-l-sky-400 text-sky-300',
  medium: 'border-l-amber-400 text-amber-300',
  high: 'border-l-orange-500 text-orange-300',
  urgent: 'border-l-rose-500 text-rose-300',
}

const ASSIGNEE_COLORS = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#2dd4bf',
  '#f472b6',
  '#c084fc',
]

function getStableColor(seed?: string | null) {
  if (!seed) return '#6b7280'
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % ASSIGNEE_COLORS.length
  }
  return ASSIGNEE_COLORS[hash]
}

export default function MyTasksPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<TaskSortKey>('due_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const supabase = createClient()

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await (supabase.from('tasks') as any)
        .select(`
          id,
          project_id,
          title,
          status,
          priority,
          due_date,
          assignee_user_id,
          assignee_agent_id,
          project:project_id(name),
          task_tags(tag_id, tags(id, name, color)),
          task_links(id, url, title),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .eq('assignee_user_id', user.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return (data ?? []) as Task[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const sortedTasks = useMemo(
    () => sortTasks(tasks as Task[], sortKey, sortDirection),
    [tasks, sortKey, sortDirection]
  )

  const changeSortKey = (key: TaskSortKey) => {
    setSortKey(key)
    setSortDirection(key === 'priority' ? 'desc' : 'asc')
  }

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    const group = sortedTasks.filter(t => t.status === status)
    if (group.length > 0) acc[status] = group
    return acc
  }, {} as Record<string, Task[]>)

  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <CheckSquare size={19} className="text-primary" />
                My Tasks
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">Assigned work collected across projects.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Sort by</span>
                <Select value={sortKey} onValueChange={value => changeSortKey(value as TaskSortKey)}>
                  <SelectTrigger size="sm" className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="due_date">Due date</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="h-7 w-7"
                  onClick={() => setSortDirection(current => current === 'asc' ? 'desc' : 'asc')}
                  title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                </Button>
              </div>
              <Badge variant="outline" className="px-2 py-1">{tasks.length} open</Badge>
            </div>
          </div>

          {loading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No tasks assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="hidden grid-cols-[minmax(0,1fr)_104px_80px_112px] px-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground md:grid">
                <span>Task</span>
                <span>Due</span>
                <span>Priority</span>
                <span>Assignee</span>
              </div>
              {Object.entries(grouped).map(([status, groupTasks]) => (
                <div key={status}>
                  <div className="mb-1.5 flex items-center gap-2 border-b border-border pb-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <span className={cn('size-2 rounded-full', getTaskStatusDotColor(status))} />
                      {getTaskStatusLabel(status)}
                    </span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{groupTasks.length}</Badge>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border bg-card/60">
                    {groupTasks.map(task => (
                      <button
                        key={task.id}
                        type="button"
                        className={cn(
                          'grid w-full cursor-pointer grid-cols-1 gap-1.5 border-b border-border/50 border-l-4 px-2.5 py-1.5 text-left transition-colors last:border-b-0 hover:bg-secondary/35 md:grid-cols-[minmax(0,1fr)_104px_80px_112px] md:items-center',
                          PRIORITY_STYLES[task.priority] ?? 'border-l-muted text-muted-foreground'
                        )}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[13px] font-medium leading-5 text-foreground">{task.title}</span>
                            {task.task_links.length > 0 && (
                              <span
                                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                                title={task.task_links[0].title ?? task.task_links[0].url}
                                onClick={event => {
                                  event.preventDefault()
                                  event.stopPropagation()
                                  window.open(task.task_links[0].url, '_blank', 'noopener,noreferrer')
                                }}
                              >
                                <LinkIcon size={12} />
                                {task.task_links.length > 1 && task.task_links.length}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="rounded border border-border bg-background/55 px-1 py-0.5 text-[9px] leading-3 text-muted-foreground">
                              {task.project?.name ?? 'No project'}
                            </span>
                            {task.task_tags.slice(0, 2).map(({ tags }) => tags && (
                              <span
                                key={tags.id}
                                className="rounded border px-1 py-0.5 text-[9px] leading-3"
                                style={{ borderColor: tags.color, color: tags.color }}
                              >
                                {tags.name}
                              </span>
                            ))}
                            {task.task_tags.length > 2 && (
                              <span className="text-[9px] text-muted-foreground">+{task.task_tags.length - 2}</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarDays size={11} />
                          {task.due_date ? format(new Date(task.due_date), 'yyyy.MM.dd') : 'No due'}
                        </div>

                        <div className="text-[10px] font-semibold uppercase">
                          {task.priority}
                        </div>

                        <div className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
                          <span
                            className="size-1.5 rounded-full ring-2 ring-background"
                            style={{ backgroundColor: getStableColor(task.assignee_agent_id ?? task.assignee_user_id) }}
                          />
                          {task.assignee_agent ? <Bot size={11} /> : <UserRound size={11} />}
                          <span className="truncate">{task.assignee_agent?.name ?? 'Me'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
