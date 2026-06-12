export const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'on_hold', 'blocked', 'in_review', 'done'] as const

export type TaskStatus = typeof TASK_STATUSES[number]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  blocked: 'Blocked',
  in_review: 'In Review',
  done: 'Done',
}

export const TASK_STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  backlog: 'bg-slate-400',
  todo: 'bg-sky-400',
  in_progress: 'bg-amber-400',
  on_hold: 'bg-zinc-400',
  blocked: 'bg-rose-500',
  in_review: 'bg-violet-400',
  done: 'bg-emerald-400',
}

export function getTaskStatusLabel(status: string) {
  return TASK_STATUS_LABELS[status as TaskStatus] ?? status.replaceAll('_', ' ')
}

export function getTaskStatusDotColor(status: string) {
  return TASK_STATUS_DOT_COLORS[status as TaskStatus] ?? 'bg-muted-foreground'
}
