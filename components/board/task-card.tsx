// components/board/task-card.tsx
'use client'

import type React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Bot, CalendarDays, GitBranch, LinkIcon, ListChecks, UserRound } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { getTaskReadiness, TASK_READINESS_STYLES } from '@/lib/task-readiness'

const PRIORITY_COLORS = {
  low: 'border-l-sky-400 hover:border-l-sky-300',
  medium: 'border-l-amber-400 hover:border-l-amber-300',
  high: 'border-l-orange-500 hover:border-l-orange-400',
  urgent: 'border-l-rose-500 hover:border-l-rose-400',
} as const

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

interface TaskCardProps {
  task: {
    id: string
    parent_task_id?: string | null
    title: string
    status: string
    priority: string
    blocked_reason?: string | null
    due_date: string | null
    handoff_note?: string | null
    assignee_user_id?: string | null
    assignee_agent_id?: string | null
    task_tags: { tags: { id: string; name: string; color: string } | null }[]
    task_links?: { id: string; url: string; title: string | null }[]
    assignee_agent: { name: string; type: string } | null
    subtask_count?: number
    completed_subtask_count?: number
    is_subtask?: boolean
  }
  onClick: () => void
}

function getStableColor(seed?: string | null) {
  if (!seed) return '#6b7280'
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % ASSIGNEE_COLORS.length
  }
  return ASSIGNEE_COLORS[hash]
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'task', status: task.status, source: 'board', task } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const assigneeId = task.assignee_agent_id ?? task.assignee_user_id
  const assigneeName = task.assignee_agent?.name ?? (task.assignee_user_id ? 'Me' : null)
  const assigneeColor = getStableColor(assigneeId)
  const firstLink = task.task_links?.[0]
  const readiness = getTaskReadiness(task)
  const subtaskCount = task.subtask_count ?? 0
  const completedSubtaskCount = task.completed_subtask_count ?? 0
  const isSubtask = task.is_subtask ?? Boolean(task.parent_task_id)

  const openFirstLink = (event: React.MouseEvent | React.PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (firstLink?.url) {
      window.open(firstLink.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'group bg-card/95 border border-l-4 border-border rounded-lg p-2.5 cursor-pointer shadow-sm shadow-black/15 transition-all space-y-1.5 hover:-translate-y-0.5 hover:border-primary/45 hover:bg-card hover:shadow-md hover:shadow-black/25',
        PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? 'border-l-muted'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-foreground">{task.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn('inline-flex size-2 rounded-full ring-2 ring-background', TASK_READINESS_STYLES[readiness.level])}
            title={readiness.title}
            aria-label={readiness.label}
            data-readiness={readiness.level}
          />
          <span className="sr-only">{readiness.label}</span>
          {isSubtask && (
            <span
              className="inline-flex size-5 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground"
              title="Subtask"
              aria-label="Subtask"
            >
              <GitBranch size={11} />
            </span>
          )}
          {subtaskCount > 0 && (
            <span
              className="inline-flex h-5 items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-1.5 text-[10px] font-medium text-primary"
              title={`${completedSubtaskCount}/${subtaskCount} subtasks complete`}
            >
              <ListChecks size={11} />
              {completedSubtaskCount}/{subtaskCount}
            </span>
          )}
          <span className="rounded-md border border-border bg-background/65 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
            {task.priority}
          </span>
        </div>
      </div>

      {task.task_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.task_tags.map(({ tags }) => tags && (
            <Badge key={tags.id} variant="outline" className="text-xs py-0 px-1.5"
              style={{ borderColor: tags.color, color: tags.color }}>
              {tags.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays size={11} />
              {format(new Date(task.due_date), 'yyyy.MM.dd')}
            </div>
          )}
          {firstLink && (
            <button
              type="button"
              className="flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title={firstLink.title ?? firstLink.url}
              onPointerDown={openFirstLink}
              onClick={openFirstLink}
            >
              <LinkIcon size={12} />
              {task.task_links && task.task_links.length > 1 && <span>{task.task_links.length}</span>}
            </button>
          )}
        </div>
        <div className="ml-auto">
          {assigneeName ? (
            <div className="flex max-w-32 items-center gap-1.5 truncate rounded-md bg-background/60 px-1.5 py-0.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full ring-2 ring-background" style={{ backgroundColor: assigneeColor }} />
              {task.assignee_agent ? <Bot size={12} /> : <UserRound size={12} />}
              <span className="truncate">{assigneeName}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
