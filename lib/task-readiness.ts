export type TaskReadinessLevel = 'ready' | 'attention' | 'blocked'

export interface TaskReadinessInput {
  assignee_user_id?: string | null
  assignee_agent_id?: string | null
  blocked_reason?: string | null
  due_date?: string | null
  handoff_note?: string | null
  status?: string | null
}

export function getTaskReadiness(task: TaskReadinessInput) {
  const issues: string[] = []
  const hasAssignee = Boolean(task.assignee_user_id || task.assignee_agent_id)

  if (!hasAssignee) issues.push('No assignee')
  if (!task.handoff_note?.trim()) issues.push('No handoff note')
  if (!task.due_date) issues.push('No due date')
  if (task.status === 'blocked' && !task.blocked_reason?.trim()) {
    issues.push('Blocked without reason')
  }

  const level: TaskReadinessLevel = task.status === 'blocked'
    ? 'blocked'
    : issues.length === 0
      ? 'ready'
      : 'attention'

  return {
    level,
    issues,
    label: level === 'ready' ? 'Ready' : level === 'blocked' ? 'Blocked' : 'Needs context',
    title: issues.length > 0 ? issues.join(', ') : 'Ready for handoff',
  }
}

export const TASK_READINESS_STYLES: Record<TaskReadinessLevel, string> = {
  ready: 'bg-emerald-400',
  attention: 'bg-amber-400',
  blocked: 'bg-rose-500',
}
