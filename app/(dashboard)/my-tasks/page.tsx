'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { TaskCard } from '@/components/board/task-card'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import { Badge } from '@/components/ui/badge'

interface Task {
  id: string
  title: string
  priority: string
  due_date: string | null
  status: string
  project_id: string
  assignee_user_id: string | null
  assignee_agent_id: string | null
  project: { name: string } | null
  task_tags: { tags: { id: string; name: string; color: string } | null }[]
  task_links: { id: string; url: string; title: string | null }[]
  assignee_agent: { name: string; type: string } | null
}

const STATUS_ORDER = ['todo', 'in_progress', 'in_review', 'backlog', 'done']

const STATUS_LABELS: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  backlog: 'Backlog',
  done: 'Done',
}

export default function MyTasksPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const supabase = createClient()

  const { data: tasks = [], isLoading: loading } = useQuery({
    queryKey: ['my-tasks'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data, error } = await (supabase.from('tasks') as any)
        .select(`
          *,
          project:project_id(name),
          task_tags(tag_id, tags(id, name, color)),
          task_links(id, url, title),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .eq('assignee_user_id', user.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false })

      if (error) throw error
      return (data ?? []) as Task[]
    },
  })

  const grouped = STATUS_ORDER.reduce((acc, status) => {
    const group = (tasks as Task[]).filter(t => t.status === status)
    if (group.length > 0) acc[status] = group
    return acc
  }, {} as Record<string, Task[]>)

  const selectedTask = tasks.find(t => t.id === selectedTaskId)

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-6">
          <h1 className="text-xl font-semibold mb-6">My Tasks</h1>

          {loading ? (
            <div className="text-muted-foreground text-sm">Loading...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>No tasks assigned to you.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(grouped).map(([status, groupTasks]) => (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-foreground">
                      {STATUS_LABELS[status]}
                    </span>
                    <Badge variant="secondary" className="text-xs">{groupTasks.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {groupTasks.map(task => (
                      <div key={task.id} className="relative pl-2">
                        <div className="absolute -left-8 top-3 text-[10px] text-muted-foreground
                          bg-secondary px-1.5 py-0.5 rounded whitespace-nowrap hidden sm:block">
                          {task.project?.name}
                        </div>
                        <TaskCard
                          task={task}
                          onClick={() => setSelectedTaskId(task.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTaskId && selectedTask && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={selectedTask.project_id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </div>
  )
}
