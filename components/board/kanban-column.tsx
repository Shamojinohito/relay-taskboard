// components/board/kanban-column.tsx
'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { TaskCard } from './task-card'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { getTaskStatusDotColor, getTaskStatusLabel } from '@/lib/task-status'

interface KanbanColumnProps {
  status: string
  tasks: Parameters<typeof TaskCard>[0]['task'][]
  isLoading?: boolean
  onTaskClick: (taskId: string) => void
  onAddTask: (status: string) => void
}

export function KanbanColumn({ status, tasks, isLoading, onTaskClick, onAddTask }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status, data: { type: 'column', status } })

  return (
    <div className="flex w-72 flex-shrink-0 flex-col border-r border-border/35 pr-4 last:border-r-0">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn('size-2 rounded-full', getTaskStatusDotColor(status))} />
          <span className="text-sm font-semibold text-foreground">{getTaskStatusLabel(status)}</span>
          <span className="rounded-full border border-border bg-background px-1.5 py-0.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={() => onAddTask(status)}>
          <Plus size={14} />
        </Button>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 min-h-32 rounded-lg border border-transparent p-2 transition-colors",
          isOver ? "border-primary/35 bg-primary/8" : "bg-background/35"
        )}
      >
        {isLoading ? (
          <>
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : (
          <>
            <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map(task => (
                <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task.id)} />
              ))}
            </SortableContext>
            {tasks.length === 0 && (
              <button
                type="button"
                onClick={() => onAddTask(status)}
                className="flex h-20 w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                Drop or add task
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
