export const TASK_ACTION_TYPES = ['content', 'research', 'review', 'publish', 'setup', 'other'] as const

export type TaskActionType = typeof TASK_ACTION_TYPES[number]

export const TASK_ACTION_TYPE_LABELS: Record<TaskActionType, string> = {
  content: 'Content',
  research: 'Research',
  review: 'Review',
  publish: 'Publish',
  setup: 'Setup',
  other: 'Other',
}

export function getTaskActionTypeLabel(actionType?: string | null) {
  if (!actionType) return TASK_ACTION_TYPE_LABELS.other
  return TASK_ACTION_TYPE_LABELS[actionType as TaskActionType] ?? actionType
}
