// components/board/kanban-board.tsx
'use client'

import { useState } from 'react'
import {
  closestCorners, CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragOverEvent,
  pointerWithin, PointerSensor, useSensor, useSensors
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
  const { tasks, error, updateStatus } = useTasks(projectId)
  const [activeTask, setActiveTask] = useState<(typeof tasks)[0] | null>(null)
  const [projectedTasks, setProjectedTasks] = useState<typeof tasks | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }))

  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args)
    const fallbackCollisions = pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args)
    const collisions = fallbackCollisions.filter(collision => collision.id !== args.active.id)

    const taskCollision = collisions.find(collision =>
      collision.data?.droppableContainer.data.current?.type === 'task'
    )
    if (taskCollision) return [taskCollision]

    const columnCollision = collisions.find(collision =>
      collision.data?.droppableContainer.data.current?.type === 'column'
    )
    if (columnCollision) return [columnCollision]

    return collisions
  }

  const getOverStatus = (overId: string, taskList: typeof tasks) => {
    const columnStatus = STATUSES.find(status => status === overId)
    if (columnStatus) return columnStatus
    return taskList.find(task => task.id === overId)?.status as TaskStatus | undefined
  }

  const isSameTaskProjection = (left: typeof tasks, right: typeof tasks) => {
    if (left.length !== right.length) return false
    return left.every((task, index) =>
      task.id === right[index]?.id && task.status === right[index]?.status
    )
  }

  const projectTaskMove = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    setProjectedTasks(current => {
      const source = current ?? tasks
      const movingTask = source.find(task => task.id === activeId)
      const overStatus = getOverStatus(overId, source)
      if (!movingTask || !overStatus) return source

      const withoutMoving = source.filter(task => task.id !== activeId)
      const nextMovingTask = { ...movingTask, status: overStatus }
      const overIndex = withoutMoving.findIndex(task => task.id === overId)
      let nextTasks: typeof source

      if (overIndex === -1) {
        const lastIndexInColumn = withoutMoving.reduce((lastIndex, task, index) =>
          task.status === overStatus ? index : lastIndex
        , -1)
        const insertIndex = lastIndexInColumn === -1 ? withoutMoving.length : lastIndexInColumn + 1
        nextTasks = [
          ...withoutMoving.slice(0, insertIndex),
          nextMovingTask,
          ...withoutMoving.slice(insertIndex),
        ]
      } else {
        nextTasks = [
          ...withoutMoving.slice(0, overIndex),
          nextMovingTask,
          ...withoutMoving.slice(overIndex),
        ]
      }

      return isSameTaskProjection(source, nextTasks) ? source : nextTasks
    })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveTask(null)
    setProjectedTasks(null)
    if (!over) return

    const newStatus = getOverStatus(String(over.id), projectedTasks ?? tasks)
    const currentStatus = tasks.find(task => task.id === active.id)?.status
    const projectedStatus = (projectedTasks ?? tasks).find(task => task.id === active.id)?.status
    const nextStatus = newStatus ?? projectedStatus

    if (nextStatus && nextStatus !== currentStatus) {
      updateStatus.mutate({ taskId: active.id as string, status: nextStatus })
    }
  }

  const visibleTasks = projectedTasks ?? tasks
  const tasksByStatus = STATUSES.reduce((acc, status) => {
    acc[status] = visibleTasks.filter(t => t.status === status)
    return acc
  }, {} as Record<TaskStatus, typeof visibleTasks>)

  return (
    <DndContext collisionDetection={collisionDetection} sensors={sensors} onDragStart={e => {
      setActiveTask(tasks.find(t => t.id === e.active.id) ?? null)
      setProjectedTasks(tasks)
    }} onDragOver={projectTaskMove} onDragCancel={() => {
      setActiveTask(null)
      setProjectedTasks(null)
    }} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-6 overflow-x-auto h-full">
        {error && (
          <div className="w-80 flex-shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load tasks: {(error as Error).message}
          </div>
        )}
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
