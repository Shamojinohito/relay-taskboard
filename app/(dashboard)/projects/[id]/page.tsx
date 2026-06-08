// app/(dashboard)/projects/[id]/page.tsx
'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { KanbanBoard } from '@/components/board/kanban-board'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import { Button } from '@/components/ui/button'
import { LayoutGrid, List, Plus } from 'lucide-react'
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
        <div className="flex items-center justify-between border-b border-border bg-background/70 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="truncate text-xl font-semibold tracking-tight">{project?.name ?? 'Loading...'}</h1>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">Project</span>
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 bg-primary/10 text-primary">
                <LayoutGrid size={13} />
                Board
              </Button>
              <Link href={`/projects/${id}/list`}>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground">
                  <List size={13} />
                  List
                </Button>
              </Link>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateStatus('backlog')}>
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
