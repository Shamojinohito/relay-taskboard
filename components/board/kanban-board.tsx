// components/board/kanban-board.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  closestCorners, CollisionDetection, DndContext, DragEndEvent, DragOverlay, DragOverEvent,
  pointerWithin, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import { KanbanColumn } from './kanban-column'
import { TaskCard } from './task-card'
import { useTasks, type TaskStatus } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'
import { TASK_STATUSES } from '@/lib/task-status'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sortTasks, type SortDirection } from '@/lib/task-sort'

const STATUSES: TaskStatus[] = [...TASK_STATUSES]

const BOARD_SORT_STORAGE_KEY = 'relay:board-sort'

type BoardSortKey = 'position' | 'due_date' | 'priority' | 'created_at'

const BOARD_SORT_LABELS: Record<BoardSortKey, string> = {
  position: 'Manual',
  due_date: 'Due date',
  priority: 'Priority',
  created_at: 'Created',
}

// 各キーの自然な向きに固定（期日=近い順・優先度=高い順・作成=新しい順）
const BOARD_SORT_DIRECTIONS: Record<BoardSortKey, SortDirection> = {
  position: 'asc',
  due_date: 'asc',
  priority: 'desc',
  created_at: 'desc',
}

function isBoardSortKey(value: string | null): value is BoardSortKey {
  return value !== null && value in BOARD_SORT_LABELS
}

interface KanbanBoardProps {
  projectId: string
  onTaskClick: (taskId: string) => void
  onAddTask: (status: string) => void
}

export function KanbanBoard({ projectId, onTaskClick, onAddTask }: KanbanBoardProps) {
  useTasksRealtime(projectId)
  const { tasks, isLoading, error, updateStatus, refetch } = useTasks(projectId)
  const [activeTask, setActiveTask] = useState<(typeof tasks)[0] | null>(null)
  const [projectedTasks, setProjectedTasks] = useState<typeof tasks | null>(null)
  // SSRとの不一致を避けるため初期値は固定し、localStorage はマウント後に読む
  const [sortKey, setSortKey] = useState<BoardSortKey>('position')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(BOARD_SORT_STORAGE_KEY)
      if (isBoardSortKey(stored)) setSortKey(stored)
    } catch {
      // storage unavailable — keep default
    }
  }, [])

  const changeSortKey = (key: BoardSortKey) => {
    setSortKey(key)
    try {
      localStorage.setItem(BOARD_SORT_STORAGE_KEY, key)
    } catch {
      // storage unavailable (private mode etc.) — preference just won't stick
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }
  }))

  const collisionDetection = useCallback<CollisionDetection>((args) => {
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
  }, [])

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
        if (movingTask.status === overStatus) return source

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
    const columnTasks = visibleTasks.filter(t => t.status === status)
    // Manual はクエリ順（position昇順）をそのまま使う。他キーは列ごとに表示順のみ並べ替え
    acc[status] = sortKey === 'position'
      ? columnTasks
      : sortTasks(columnTasks, sortKey, BOARD_SORT_DIRECTIONS[sortKey])
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
      <div className="flex h-full flex-col bg-background">
        <div className="flex items-center justify-end gap-2 border-b border-border/60 px-6 py-2">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <Select value={sortKey} onValueChange={value => changeSortKey(value as BoardSortKey)}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue>{(v: string) => BOARD_SORT_LABELS[v as BoardSortKey] ?? v}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="position">Manual</SelectItem>
              <SelectItem value="due_date">Due date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="created_at">Created</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-1 gap-5 overflow-x-auto px-6 py-5">
        {error ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-8 text-sm text-destructive">
            <p>Failed to load tasks: {(error as Error).message}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : isLoading ? (
          STATUSES.map(status => (
            <KanbanColumn key={status} status={status} tasks={[]} isLoading onTaskClick={onTaskClick} onAddTask={onAddTask} />
          ))
        ) : tasks.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <p className="text-sm">No tasks yet.</p>
            <Button size="sm" onClick={() => onAddTask('backlog')}>Create your first task</Button>
          </div>
        ) : (
          STATUSES.map(status => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskClick={onTaskClick}
              onAddTask={onAddTask}
            />
          ))
        )}
        </div>
      </div>
      <DragOverlay>
        {activeTask && (
          <TaskCard task={activeTask} onClick={() => {}} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
