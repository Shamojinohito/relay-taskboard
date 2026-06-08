import { TASK_STATUSES } from '@/lib/task-status'

export type TaskSortKey = 'title' | 'status' | 'priority' | 'assignee' | 'due_date' | 'project' | 'position'
export type SortDirection = 'asc' | 'desc'

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const STATUS_RANK: Record<string, number> = Object.fromEntries(
  TASK_STATUSES.map((status, index) => [status, index + 1])
)

interface SortableTask {
  title?: string | null
  status?: string | null
  priority?: string | null
  due_date?: string | null
  position?: number | null
  project?: { name?: string | null } | null
  assignee_agent?: { name?: string | null } | null
  assignee_user?: { email?: string | null } | null
  assignee_user_id?: string | null
}

function getAssigneeName(task: SortableTask) {
  return task.assignee_agent?.name ?? task.assignee_user?.email ?? task.assignee_user_id ?? ''
}

function getSortValue(task: SortableTask, key: TaskSortKey) {
  switch (key) {
    case 'title':
      return task.title ?? ''
    case 'status':
      return STATUS_RANK[task.status ?? ''] ?? 99
    case 'priority':
      return PRIORITY_RANK[task.priority ?? ''] ?? 0
    case 'assignee':
      return getAssigneeName(task)
    case 'due_date':
      return task.due_date ? new Date(task.due_date).getTime() : Number.POSITIVE_INFINITY
    case 'project':
      return task.project?.name ?? ''
    case 'position':
      return task.position ?? Number.POSITIVE_INFINITY
  }
}

function compareValues(valueA: string | number, valueB: string | number, multiplier: number) {
  if (typeof valueA === 'number' && typeof valueB === 'number') {
    if (!Number.isFinite(valueA) && !Number.isFinite(valueB)) return 0
    if (!Number.isFinite(valueA)) return 1
    if (!Number.isFinite(valueB)) return -1
    return (valueA - valueB) * multiplier
  }

  return String(valueA).localeCompare(String(valueB), undefined, {
    numeric: true,
    sensitivity: 'base',
  }) * multiplier
}

export function sortTasks<T extends SortableTask>(
  tasks: T[],
  key: TaskSortKey,
  direction: SortDirection
) {
  const multiplier = direction === 'asc' ? 1 : -1

  return [...tasks].sort((a, b) => {
    const valueA = getSortValue(a, key)
    const valueB = getSortValue(b, key)
    const result = compareValues(valueA, valueB, multiplier)
    if (result !== 0) return result
    return compareValues(a.title ?? '', b.title ?? '', 1)
  })
}
