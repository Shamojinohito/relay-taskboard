// app/(dashboard)/projects/[id]/page.tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { KanbanBoard } from '@/components/board/kanban-board'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import ProjectViewHeader from '@/components/projects/project-view-header'
import { useProjects } from '@/hooks/use-projects'

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>()
  const { projects } = useProjects()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = (projects as any[]).find((p: any) => p.id === id) as { id: string; name: string } | undefined
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createStatus, setCreateStatus] = useState<string | null>(null)

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <ProjectViewHeader
          projectId={id}
          projectName={project?.name}
          activeView="board"
          onAddTask={() => setCreateStatus('backlog')}
        />

        <KanbanBoard
          projectId={id}
          onTaskClick={setSelectedTaskId}
          onAddTask={setCreateStatus}
        />
      </div>

      {selectedTaskId && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {createStatus && (
        <TaskForm
          projectId={id}
          initialStatus={createStatus}
          onClose={() => setCreateStatus(null)}
        />
      )}
    </div>
  )
}
