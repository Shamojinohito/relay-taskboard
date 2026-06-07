// components/board/kanban-board.tsx
'use client'

import { useState } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import { KanbanColumn } from './kanban-column'
import { TaskCard } from './task-card'
import { useTasks, type TaskStatus } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'

const STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done']

interface KanbanBoardProps {
  projectId: string
  onTaskClick: (taskId: string) => void
  onAddTask: (status: string) => void
}

export function KanbanBoard({ projectId, onTaskClick, onAddTask }: KanbanBoardProps) {
  useTasksRealtime(projectId)
  const { tasks, updateStatus } = useTasks(projectId)
  const [activeTask, setActiveTask] = useState<(typeof tasks)[0] | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    if (!over || active.id === over.id) return

    const newStatus = STATUSES.find(s => s === over.id)
    if (newStatus) {
      updateStatus.mutate({ taskId: active.id as string, status: newStatus })
    }
  }

  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter(t => t.status === status)
    return acc
  }, {} as Record<TaskStatus, typeof tasks>)

  return (
    <DndContext sensors={sensors} onDragStart={e => {
      setActiveTask(tasks.find(t => t.id === e.active.id) ?? null)
    }} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {STATUSES.map(status => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            onTaskClick={onTaskClick}
            onAddTask={onAddTask}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} onClick={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
