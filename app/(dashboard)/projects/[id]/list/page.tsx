'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useTasks } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'
import { useProjects } from '@/hooks/use-projects'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import TaskListView from '@/components/tasks/task-list-view'
import ProjectViewHeader from '@/components/projects/project-view-header'
import type { TaskStatus } from '@/lib/task-status'

export default function ProjectListPage() {
  const { id } = useParams<{ id: string }>()
  const { projects } = useProjects()
  const project = projects.find((p: any) => p.id === id)
  const { tasks, isLoading, error, updateStatus, refetch } = useTasks(id, { includeSubtasks: true })
  useTasksRealtime(id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const changeStatus = (taskId: string, status: TaskStatus) => {
    updateStatus.mutate({ taskId, status })
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <ProjectViewHeader
          projectId={id}
          projectName={(project as any)?.name}
          activeView="list"
          onAddTask={() => setCreateOpen(true)}
        />

        <div className="flex-1 overflow-auto">
          <TaskListView
            tasks={tasks as any[]}
            isLoading={isLoading}
            error={error as Error | null}
            onRetry={() => refetch()}
            onTaskClick={setSelectedTaskId}
            onStatusChange={changeStatus}
            defaultSortKey="position"
            enablePositionSort
          />
        </div>
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {createOpen && (
        <TaskForm
          projectId={id}
          initialStatus="backlog"
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  )
}
