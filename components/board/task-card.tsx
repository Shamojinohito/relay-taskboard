// components/board/task-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Bot, CalendarDays, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
} as const

interface TaskCardProps {
  task: {
    id: string
    title: string
    status: string
    priority: string
    due_date: string | null
    task_tags: { tags: { id: string; name: string; color: string } | null }[]
    assignee_user?: { email: string; raw_user_meta_data: Record<string, string> } | null
    assignee_agent: { name: string; type: string } | null
  }
  onClick: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'task', status: task.status } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/50 transition-colors space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-foreground leading-snug">{task.title}</p>
        <AlertCircle size={14} className={cn('flex-shrink-0 mt-0.5', PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS])} />
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
            {format(new Date(task.due_date), 'MMM d')}
          </div>
        )}
        <div className="ml-auto">
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
          ) : null}
        </div>
      </div>
    </div>
  )
}
