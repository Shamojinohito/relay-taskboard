// app/(dashboard)/projects/[id]/page.tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { KanbanBoard } from '@/components/board/kanban-board'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useProjects } from '@/hooks/use-projects'
import Link from 'next/link'

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{project?.name ?? 'Loading...'}</h1>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="text-primary">Board</Button>
              <Link href={`/projects/${id}/list`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground">List</Button>
              </Link>
            </div>
          </div>
          <Button size="sm" onClick={() => setCreateStatus('backlog')}>
            <Plus size={14} className="mr-1" /> Add Task
          </Button>
        </div>

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
