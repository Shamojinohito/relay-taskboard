// components/board/kanban-board.tsx
'use client'

import { useEffect, useState } from 'react'
import { DragEndEvent, DragOverEvent, DragStartEvent, useDndMonitor } from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { KanbanColumn } from './kanban-column'
import { useTasks, type TaskStatus } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'
import { createClient } from '@/lib/supabase/client'
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
  const { tasks, isLoading, error, refetch } = useTasks(projectId)
  const [projectedTasks, setProjectedTasks] = useState<typeof tasks | null>(null)
  const queryClient = useQueryClient()
  const supabase = createClient()
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

  // このボードのカードのドラッグかどうか（共通DndContext配下で他ビューのイベントも流れてくる）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isBoardDrag = (active: { data: { current?: any } }) => {
    const data = active.data.current
    return data?.type === 'task' && data.source === 'board' && data.task?.project_id === projectId
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

  // ドロップ結果の永続化: ステータス変更 + （手動順のとき）対象列の position 振り直し
  const persistDrop = async (finalTasks: typeof tasks, movedTaskId: string, nextStatus: TaskStatus | undefined, currentStatus: TaskStatus | undefined) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: { id: string; fields: Record<string, any> }[] = []

    if (nextStatus && nextStatus !== currentStatus) {
      updates.push({ id: movedTaskId, fields: { status: nextStatus } })
    }

    if (sortKey === 'position') {
      const targetStatus = nextStatus ?? currentStatus
      const columnTasks = finalTasks.filter(task => task.status === targetStatus)
      columnTasks.forEach((task, index) => {
        const original = tasks.find(t => t.id === task.id)
        if (original?.position === index) return
        const existing = updates.find(u => u.id === task.id)
        if (existing) existing.fields.position = index
        else updates.push({ id: task.id, fields: { position: index } })
      })
    }

    if (updates.length === 0) return

    // 楽観的更新: 投影済みの並びとステータスをそのままクエリキャッシュへ
    const fieldsById = new Map(updates.map(u => [u.id, u.fields]))
    queryClient.setQueryData(['tasks', projectId], finalTasks.map(task => {
      const fields = fieldsById.get(task.id)
      return fields ? { ...task, ...fields } : task
    }))

    await Promise.all(updates.map(({ id, fields }) =>
      (supabase.from('tasks') as any).update(fields).eq('id', id)
    ))
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
    queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
    queryClient.invalidateQueries({ queryKey: ['triage-inbox'] })
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    const finalTasks = projectedTasks ?? tasks
    setProjectedTasks(null)
    if (!over) return

    // サイドバーへのドロップは共通プロバイダが処理する
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const overType = (over.data.current as any)?.type
    if (overType === 'sidebar-project' || overType === 'sidebar-my-tasks') return

    const newStatus = getOverStatus(String(over.id), finalTasks)
    const currentStatus = tasks.find(task => task.id === active.id)?.status as TaskStatus | undefined
    const projectedStatus = finalTasks.find(task => task.id === active.id)?.status as TaskStatus | undefined
    const nextStatus = newStatus ?? projectedStatus

    void persistDrop(finalTasks, String(active.id), nextStatus, currentStatus)
  }

  useDndMonitor({
    onDragStart(event: DragStartEvent) {
      if (isBoardDrag(event.active)) setProjectedTasks(tasks)
    },
    onDragOver(event: DragOverEvent) {
      if (isBoardDrag(event.active)) projectTaskMove(event)
    },
    onDragCancel() {
      setProjectedTasks(null)
    },
    onDragEnd(event: DragEndEvent) {
      if (isBoardDrag(event.active)) handleDragEnd(event)
      else setProjectedTasks(null)
    },
  })

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
  )
}
