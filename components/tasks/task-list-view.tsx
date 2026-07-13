'use client'

// 全リスト系ビュー（プロジェクトList / My Tasks / Today / Inbox）共通のタスク一覧。
// ソート可能列・完了チェックボックス・Active/Done/Allフィルタを一箇所に集約する。
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import {
  AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Bot, CalendarDays, GitBranch, ListChecks, UserRound,
} from 'lucide-react'
import { TaskCompleteToggle, TaskStatusChip } from '@/components/tasks/quick-status'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { sortTasks, type SortDirection, type TaskSortKey } from '@/lib/task-sort'
import type { TaskStatus } from '@/lib/task-status'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
}

export type StatusFilter = 'active' | 'done' | 'all'

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  active: 'Active',
  done: 'Done',
  all: 'All',
}

const STATUS_FILTER_STORAGE_KEY = 'relay:list-filter'

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === 'active' || value === 'done' || value === 'all'
}

function matchesStatusFilter(status: string, filter: StatusFilter) {
  if (filter === 'all') return true
  if (filter === 'done') return status === 'done'
  return status !== 'done'
}

function SortHeader({
  label,
  sort,
  activeKey,
  direction,
  onToggle,
}: {
  label: string
  sort: TaskSortKey
  activeKey: TaskSortKey
  direction: SortDirection
  onToggle: (key: TaskSortKey) => void
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 text-left font-medium transition-colors hover:text-foreground"
      onClick={() => onToggle(sort)}
    >
      {label}
      {activeKey !== sort
        ? <ArrowUpDown size={12} className="text-muted-foreground/60" />
        : direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
    </button>
  )
}

interface TaskListViewProps {
  tasks: any[]
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
  onTaskClick: (taskId: string) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  /** 横断ビュー（My Tasks / Today / Inbox）で Project 列を出す */
  showProject?: boolean
  defaultSortKey?: TaskSortKey
  /** プロジェクトList用: 手動順（position）ソートと親子グルーピングを有効化 */
  enablePositionSort?: boolean
  /** Inbox のようにフィルタが意味を持たないビューでは false */
  showStatusFilter?: boolean
  /** タイトル先頭に差し込む要素（Inbox の Reason チップ等） */
  renderLeading?: (task: any) => ReactNode
  emptyMessage?: string
}

export default function TaskListView({
  tasks,
  isLoading,
  error,
  onRetry,
  onTaskClick,
  onStatusChange,
  showProject = false,
  defaultSortKey = 'due_date',
  enablePositionSort = false,
  showStatusFilter = true,
  renderLeading,
  emptyMessage = 'No tasks yet.',
}: TaskListViewProps) {
  const [sortKey, setSortKey] = useState<TaskSortKey>(defaultSortKey)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    defaultSortKey === 'priority' ? 'desc' : 'asc'
  )
  // SSRとの不一致を避けるため初期値は固定し、localStorage はマウント後に読む
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  useEffect(() => {
    if (!showStatusFilter) return
    try {
      const stored = localStorage.getItem(STATUS_FILTER_STORAGE_KEY)
      if (isStatusFilter(stored)) setStatusFilter(stored)
    } catch {
      // storage unavailable — keep default
    }
  }, [showStatusFilter])

  const changeStatusFilter = (filter: StatusFilter) => {
    setStatusFilter(filter)
    try {
      localStorage.setItem(STATUS_FILTER_STORAGE_KEY, filter)
    } catch {
      // storage unavailable (private mode etc.) — preference just won't stick
    }
  }

  const effectiveFilter: StatusFilter = showStatusFilter ? statusFilter : 'all'

  const filteredTasks = useMemo(
    () => tasks.filter(task => matchesStatusFilter(task.status, effectiveFilter)),
    [tasks, effectiveFilter]
  )

  const filterCounts = useMemo(() => ({
    active: tasks.filter(task => task.status !== 'done').length,
    done: tasks.filter(task => task.status === 'done').length,
    all: tasks.length,
  }), [tasks])

  const sortedTasks = useMemo(
    () => sortTasks(filteredTasks, sortKey, sortDirection),
    [filteredTasks, sortKey, sortDirection]
  )

  // 手動順（position）のときのみ親タスク直下にサブタスクを畳み込む
  const displayTasks = useMemo(() => {
    if (!enablePositionSort || sortKey !== 'position') return sortedTasks

    const childTasksByParent = new Map<string, any[]>()
    const parentTasks: any[] = []
    const orphanSubtasks: any[] = []

    for (const task of sortedTasks) {
      if (!task.parent_task_id) {
        parentTasks.push(task)
        continue
      }
      const siblings = childTasksByParent.get(task.parent_task_id) ?? []
      siblings.push(task)
      childTasksByParent.set(task.parent_task_id, siblings)
    }

    const parentIds = new Set(parentTasks.map(task => task.id))
    for (const task of sortedTasks) {
      if (task.parent_task_id && !parentIds.has(task.parent_task_id)) orphanSubtasks.push(task)
    }

    return parentTasks.flatMap(task => [task, ...(childTasksByParent.get(task.id) ?? [])]).concat(orphanSubtasks)
  }, [enablePositionSort, sortKey, sortedTasks])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const isOverdue = (task: any) =>
    Boolean(task.due_date) && task.due_date < todayStr && task.status !== 'done'

  const toggleSort = (key: TaskSortKey) => {
    if (sortKey === key) {
      setSortDirection(current => current === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortKey(key)
    setSortDirection(key === 'priority' ? 'desc' : 'asc')
  }

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

  const renderDue = (task: any) => (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs',
      isOverdue(task) ? 'font-medium text-rose-500' : 'text-muted-foreground'
    )}>
      <CalendarDays size={11} />
      {task.due_date ? format(new Date(task.due_date), 'yyyy.MM.dd') : '—'}
    </span>
  )

  const gridCols = showProject
    ? 'md:grid-cols-[minmax(0,1fr)_144px_128px_88px_112px_104px]'
    : 'md:grid-cols-[minmax(0,1fr)_128px_88px_112px_104px]'

  return (
    <>
      {showStatusFilter && (
        <div className="flex items-center border-b border-border/60 px-4 py-2 sm:px-6">
          <div className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
            {(['active', 'done', 'all'] as const).map(filter => (
              <button
                key={filter}
                type="button"
                onClick={() => changeStatusFilter(filter)}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
                  statusFilter === filter
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {STATUS_FILTER_LABELS[filter]}
                <span className="text-[10px] tabular-nums opacity-70">{filterCounts[filter]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error ? (
        <div className="px-6 py-10 text-center text-sm text-destructive">
          <p>Failed to load tasks: {error.message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : isLoading ? (
        <div className="space-y-2 px-4 py-4 md:px-6">
          {[0, 1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="px-6 py-10 text-center text-sm text-muted-foreground">
          {tasks.length === 0
            ? emptyMessage
            : effectiveFilter === 'done'
              ? 'No completed tasks.'
              : 'No active tasks.'}
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
                onClick={() => onTaskClick(task.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onTaskClick(task.id)
                  }
                }}
              >
                <TaskCompleteToggle
                  status={task.status}
                  onChange={status => onStatusChange(task.id, status)}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    {renderLeading?.(task)}
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
                      onChange={status => onStatusChange(task.id, status)}
                    />
                    <span className={cn('inline-flex items-center gap-1 text-[11px]', PRIORITY_COLORS[task.priority] ?? 'text-muted-foreground')}>
                      <AlertCircle size={11} />
                      {task.priority}
                    </span>
                    {task.due_date && renderDue(task)}
                    {showProject && (
                      <span className="rounded border border-border bg-background/55 px-1 py-0.5 text-[10px] leading-3 text-muted-foreground">
                        {task.project?.name ?? 'No project'}
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
          <div className={cn('hidden border-b border-border px-4 py-3 text-xs text-muted-foreground sm:px-6 md:grid md:items-center md:gap-3', gridCols)}>
            <SortHeader label="Title" sort="title" activeKey={sortKey} direction={sortDirection} onToggle={toggleSort} />
            {showProject && <SortHeader label="Project" sort="project" activeKey={sortKey} direction={sortDirection} onToggle={toggleSort} />}
            <SortHeader label="Status" sort="status" activeKey={sortKey} direction={sortDirection} onToggle={toggleSort} />
            <SortHeader label="Priority" sort="priority" activeKey={sortKey} direction={sortDirection} onToggle={toggleSort} />
            <SortHeader label="Assignee" sort="assignee" activeKey={sortKey} direction={sortDirection} onToggle={toggleSort} />
            <SortHeader label="Due" sort="due_date" activeKey={sortKey} direction={sortDirection} onToggle={toggleSort} />
          </div>
          <div className="hidden md:block">
            {displayTasks.map((task: any) => (
              <div
                key={task.id}
                role="button"
                tabIndex={0}
                className={cn(
                  'grid w-full cursor-pointer grid-cols-1 gap-3 border-b border-border/50 px-4 py-2.5 text-left transition-colors hover:bg-secondary/30 sm:px-6 md:items-center',
                  gridCols,
                  task.parent_task_id && 'bg-secondary/10'
                )}
                onClick={() => onTaskClick(task.id)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onTaskClick(task.id)
                  }
                }}
              >
                <div className={cn('flex min-w-0 items-center gap-2.5', task.parent_task_id && 'pl-5')}>
                  <TaskCompleteToggle
                    status={task.status}
                    onChange={status => onStatusChange(task.id, status)}
                  />
                  {renderLeading?.(task)}
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
                {showProject && (
                  <span className="truncate text-xs text-muted-foreground">
                    {task.project?.name ?? 'No project'}
                  </span>
                )}
                <div>
                  <TaskStatusChip
                    status={task.status}
                    onChange={status => onStatusChange(task.id, status)}
                  />
                </div>
                <div className={cn('flex items-center gap-1 text-xs', PRIORITY_COLORS[task.priority] ?? '')}>
                  <AlertCircle size={12} />
                  {task.priority}
                </div>
                <div>{renderAssignee(task)}</div>
                <div>{renderDue(task)}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
