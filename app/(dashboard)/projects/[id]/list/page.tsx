'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTasks } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'
import { useProjects } from '@/hooks/use-projects'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import ProjectViewHeader from '@/components/projects/project-view-header'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bot, AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, GitBranch, ListChecks } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { sortTasks, type SortDirection, type TaskSortKey } from '@/lib/task-sort'
import { getTaskStatusDotColor, getTaskStatusLabel } from '@/lib/task-status'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
}

export default function ProjectListPage() {
  const { id } = useParams<{ id: string }>()
  const { projects } = useProjects()
  const project = projects.find((p: any) => p.id === id)
  const { tasks, isLoading, error, refetch } = useTasks(id, { includeSubtasks: true })
  useTasksRealtime(id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [sortKey, setSortKey] = useState<TaskSortKey>('position')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  const sortedTasks = useMemo(
    () => sortTasks(tasks as any[], sortKey, sortDirection),
    [tasks, sortKey, sortDirection]
  )

  const displayTasks = useMemo(() => {
    if (sortKey !== 'position') return sortedTasks

    const childTasksByParent = new Map<string, any[]>()
    const parentTasks: any[] = []
    const orphanSubtasks: any[] = []

    for (const task of sortedTasks as any[]) {
      if (!task.parent_task_id) {
        parentTasks.push(task)
        continue
      }

      const siblings = childTasksByParent.get(task.parent_task_id) ?? []
      siblings.push(task)
      childTasksByParent.set(task.parent_task_id, siblings)
    }

    const parentIds = new Set(parentTasks.map(task => task.id))
    for (const task of sortedTasks as any[]) {
      if (task.parent_task_id && !parentIds.has(task.parent_task_id)) orphanSubtasks.push(task)
    }

    return parentTasks.flatMap(task => [task, ...(childTasksByParent.get(task.id) ?? [])]).concat(orphanSubtasks)
  }, [sortKey, sortedTasks])

  const toggleSort = (key: TaskSortKey) => {
    if (sortKey === key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection(key === 'priority' ? 'desc' : 'asc')
  }

  const renderSortIcon = (key: TaskSortKey) => {
    if (sortKey !== key) return <ArrowUpDown size={12} className="text-muted-foreground/60" />
    return sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
  }

  const SortHeader = ({ label, sort }: { label: string; sort: TaskSortKey }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-left font-medium transition-colors hover:text-foreground"
      onClick={() => toggleSort(sort)}
    >
      {label}
      {renderSortIcon(sort)}
    </button>
  )

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <ProjectViewHeader
          projectId={id}
          projectName={(project as any)?.name}
          activeView="list"
          onAddTask={() => setCreateOpen(true)}
        />

        <div className="flex-1 overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="text-left px-6 py-3 font-medium"><SortHeader label="Title" sort="title" /></th>
                <th className="text-left px-4 py-3 font-medium w-28"><SortHeader label="Status" sort="status" /></th>
                <th className="text-left px-4 py-3 font-medium w-24"><SortHeader label="Priority" sort="priority" /></th>
                <th className="text-left px-4 py-3 font-medium w-28"><SortHeader label="Assignee" sort="assignee" /></th>
                <th className="text-left px-4 py-3 font-medium w-24"><SortHeader label="Due" sort="due_date" /></th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-destructive">
                    <p>Failed to load tasks: {(error as Error).message}</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                      Retry
                    </Button>
                  </td>
                </tr>
              ) : isLoading ? (
                [0, 1, 2, 3, 4].map(i => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-6 py-3" colSpan={5}>
                      <Skeleton className="h-5 w-full rounded" />
                    </td>
                  </tr>
                ))
              ) : displayTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-muted-foreground">
                    No tasks yet.
                  </td>
                </tr>
              ) : displayTasks.map((task: any) => (
                <tr key={task.id}
                  className={cn(
                    'border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors',
                    task.parent_task_id && 'bg-secondary/10'
                  )}
                  onClick={() => setSelectedTaskId(task.id)}>
                  <td className="px-6 py-3">
                    <div className={cn('flex min-w-0 items-center gap-2', task.parent_task_id && 'pl-5')}>
                      {task.parent_task_id && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          <GitBranch size={11} />
                          Subtask
                        </span>
                      )}
                      <span className={cn('truncate text-sm text-foreground', task.parent_task_id && 'text-muted-foreground')}>
                        {task.title}
                      </span>
                      {!task.parent_task_id && task.subtask_count > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          <ListChecks size={11} />
                          {task.completed_subtask_count}/{task.subtask_count}
                        </span>
                      )}
                    </div>
                    {task.task_tags?.map(({ tags }: any) => tags && (
                      <Badge key={tags.id} variant="outline" className="ml-2 text-xs py-0 px-1.5"
                        style={{ borderColor: tags.color, color: tags.color }}>
                        {tags.name}
                      </Badge>
                    ))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn('size-2 rounded-full', getTaskStatusDotColor(task.status))} />
                      {getTaskStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className={cn('flex items-center gap-1 text-xs', PRIORITY_COLORS[task.priority] ?? '')}>
                      <AlertCircle size={12} />
                      {task.priority}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {task.assignee_agent ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Bot size={12} />
                        <span>{task.assignee_agent.name}</span>
                      </div>
                    ) : task.assignee_user ? (
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={task.assignee_user.raw_user_meta_data?.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {task.assignee_user.email.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {task.due_date ? format(new Date(task.due_date), 'yyyy.MM.dd') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {createOpen && (
        <TaskForm
          projectId={id}
          initialStatus="backlog"
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  )
}
