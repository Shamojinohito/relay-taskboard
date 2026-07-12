'use client'

import { useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTasks } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'
import { useProjects } from '@/hooks/use-projects'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import ProjectViewHeader from '@/components/projects/project-view-header'
import { TaskCompleteToggle, TaskStatusChip } from '@/components/tasks/quick-status'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Bot, AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, CalendarDays, GitBranch, ListChecks, UserRound } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { sortTasks, type SortDirection, type TaskSortKey } from '@/lib/task-sort'
import type { TaskStatus } from '@/lib/task-status'

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
  const { tasks, isLoading, error, updateStatus, refetch } = useTasks(id, { includeSubtasks: true })
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

  const changeStatus = (taskId: string, status: TaskStatus) => {
    updateStatus.mutate({ taskId, status })
  }

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

  const renderAssignee = (task: any) =>
    task.assignee_agent ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Bot size={12} />
        <span className="truncate">{task.assignee_agent.name}</span>
      </span>
    ) : task.assignee_user_id ? (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <UserRound size={12} />
        <span>Me</span>
      </span>
    ) : (
      <span className="text-xs text-muted-foreground">—</span>
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
          {error ? (
            <div className="px-6 py-10 text-center text-sm text-destructive">
              <p>Failed to load tasks: {(error as Error).message}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 px-4 py-4 md:px-6">
              {[0, 1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-10 w-full rounded" />
              ))}
            </div>
          ) : displayTasks.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              No tasks yet.
            </div>
          ) : (
            <>
              {/* Mobile: card list */}
              <div className="md:hidden">
                {displayTasks.map((task: any) => (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      'flex w-full cursor-pointer items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors active:bg-secondary/40',
                      task.parent_task_id && 'bg-secondary/10 pl-8'
                    )}
                    onClick={() => setSelectedTaskId(task.id)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        setSelectedTaskId(task.id)
                      }
                    }}
                  >
                    <TaskCompleteToggle
                      status={task.status}
                      onChange={status => changeStatus(task.id, status)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        {task.parent_task_id && (
                          <GitBranch size={12} className="shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            'truncate text-sm font-medium text-foreground',
                            task.status === 'done' && 'text-muted-foreground line-through'
                          )}
                        >
                          {task.title}
                        </span>
                        {!task.parent_task_id && task.subtask_count > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            <ListChecks size={11} />
                            {task.completed_subtask_count}/{task.subtask_count}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <TaskStatusChip
                          status={task.status}
                          onChange={status => changeStatus(task.id, status)}
                        />
                        <span className={cn('inline-flex items-center gap-1 text-[11px]', PRIORITY_COLORS[task.priority] ?? 'text-muted-foreground')}>
                          <AlertCircle size={11} />
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            <CalendarDays size={11} />
                            {format(new Date(task.due_date), 'MM.dd')}
                          </span>
                        )}
                        {renderAssignee(task)}
                        {task.task_tags?.slice(0, 2).map(({ tags }: any) => tags && (
                          <span
                            key={tags.id}
                            className="rounded border px-1 py-0.5 text-[10px] leading-3"
                            style={{ borderColor: tags.color, color: tags.color }}
                          >
                            {tags.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <table className="hidden w-full min-w-[42rem] table-fixed md:table">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="text-left px-6 py-3 font-medium"><SortHeader label="Title" sort="title" /></th>
                    <th className="text-left px-4 py-3 font-medium w-32"><SortHeader label="Status" sort="status" /></th>
                    <th className="text-left px-4 py-3 font-medium w-20"><SortHeader label="Priority" sort="priority" /></th>
                    <th className="text-left px-4 py-3 font-medium w-24"><SortHeader label="Assignee" sort="assignee" /></th>
                    <th className="text-left px-4 py-3 font-medium w-24"><SortHeader label="Due" sort="due_date" /></th>
                  </tr>
                </thead>
                <tbody>
                  {displayTasks.map((task: any) => (
                    <tr key={task.id}
                      className={cn(
                        'border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors',
                        task.parent_task_id && 'bg-secondary/10'
                      )}
                      onClick={() => setSelectedTaskId(task.id)}>
                      <td className="px-6 py-3">
                        <div className={cn('flex min-w-0 items-center gap-2.5', task.parent_task_id && 'pl-5')}>
                          <TaskCompleteToggle
                            status={task.status}
                            onChange={status => changeStatus(task.id, status)}
                          />
                          {task.parent_task_id && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <GitBranch size={11} />
                              Subtask
                            </span>
                          )}
                          <span
                            className={cn(
                              'truncate text-sm text-foreground',
                              task.parent_task_id && 'text-muted-foreground',
                              task.status === 'done' && 'text-muted-foreground line-through'
                            )}
                          >
                            {task.title}
                          </span>
                          {!task.parent_task_id && task.subtask_count > 0 && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                              <ListChecks size={11} />
                              {task.completed_subtask_count}/{task.subtask_count}
                            </span>
                          )}
                          {task.task_tags?.map(({ tags }: any) => tags && (
                            <Badge key={tags.id} variant="outline" className="text-xs py-0 px-1.5"
                              style={{ borderColor: tags.color, color: tags.color }}>
                              {tags.name}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TaskStatusChip
                          status={task.status}
                          onChange={status => changeStatus(task.id, status)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className={cn('flex items-center gap-1 text-xs', PRIORITY_COLORS[task.priority] ?? '')}>
                          <AlertCircle size={12} />
                          {task.priority}
                        </div>
                      </td>
                      <td className="px-4 py-3">{renderAssignee(task)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {task.due_date ? format(new Date(task.due_date), 'yyyy.MM.dd') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
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
