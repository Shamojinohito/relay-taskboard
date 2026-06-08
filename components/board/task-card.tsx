// components/board/task-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Bot, CalendarDays, UserRound } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS = {
  low: 'border-l-sky-400',
  medium: 'border-l-amber-400',
  high: 'border-l-orange-500',
  urgent: 'border-l-rose-500',
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
    title: string
    status: string
    priority: string
    due_date: string | null
    assignee_user_id?: string | null
    assignee_agent_id?: string | null
    task_tags: { tags: { id: string; name: string; color: string } | null }[]
    assignee_agent: { name: string; type: string } | null
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
    useSortable({ id: task.id, data: { type: 'task', status: task.status } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  const assigneeId = task.assignee_agent_id ?? task.assignee_user_id
  const assigneeName = task.assignee_agent?.name ?? (task.assignee_user_id ? 'Me' : null)
  const assigneeColor = getStableColor(assigneeId)

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-card border border-l-4 border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors space-y-2',
        PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? 'border-l-muted'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground leading-snug">{task.title}</p>
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
          {task.priority}
        </span>
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
        {task.due_date && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays size={11} />
            {format(new Date(task.due_date), 'yyyy.MM.dd')}
          </div>
        )}
        <div className="ml-auto">
          {assigneeName ? (
            <div className="flex max-w-32 items-center gap-1.5 truncate text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: assigneeColor }} />
              {task.assignee_agent ? <Bot size={12} /> : <UserRound size={12} />}
              <span className="truncate">{assigneeName}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
