// components/board/kanban-column.tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './task-card'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const COLUMN_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

interface KanbanColumnProps {
  status: string
  tasks: Parameters<typeof TaskCard>[0]['task'][]
  onTaskClick: (taskId: string) => void
  onAddTask: (status: string) => void
}

export function KanbanColumn({ status, tasks, onTaskClick, onAddTask }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status, data: { type: 'column', status } })

  return (
    <div className="flex w-72 flex-shrink-0 flex-col border-r border-border/40 pr-4 last:border-r-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{COLUMN_LABELS[status]}</span>
          <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6"
          onClick={() => onAddTask(status)}>
          <Plus size={14} />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-24 rounded-lg p-2 transition-colors",
          isOver ? "bg-primary/5" : "bg-transparent"
        )}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
          ))}
        </SortableContext>
      </div>
    </div>
  )
}
