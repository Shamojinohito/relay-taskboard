'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useTasks } from '@/hooks/use-tasks'
import { useTasksRealtime } from '@/hooks/use-realtime'
import { useProjects } from '@/hooks/use-projects'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Plus, Bot, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-blue-400',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
}

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
}

export default function ProjectListPage() {
  const { id } = useParams<{ id: string }>()
  const { projects } = useProjects()
  const project = projects.find((p: any) => p.id === id)
  const { tasks } = useTasks(id)
  useTasksRealtime(id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">{(project as any)?.name ?? 'Loading...'}</h1>
            <div className="flex gap-1">
              <Link href={`/projects/${id}`}>
                <Button variant="ghost" size="sm" className="text-muted-foreground">Board</Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-primary">List</Button>
            </div>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} className="mr-1" /> Add Task
          </Button>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="text-left px-6 py-3 font-medium">Title</th>
              <th className="text-left px-4 py-3 font-medium w-28">Status</th>
              <th className="text-left px-4 py-3 font-medium w-24">Priority</th>
              <th className="text-left px-4 py-3 font-medium w-28">Assignee</th>
              <th className="text-left px-4 py-3 font-medium w-24">Due</th>
            </tr>
          </thead>
          <tbody>
            {(tasks as any[]).map((task: any) => (
              <tr key={task.id}
                className="border-b border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors"
                onClick={() => setSelectedTaskId(task.id)}>
                <td className="px-6 py-3">
                  <span className="text-sm text-foreground">{task.title}</span>
                  {task.task_tags?.map(({ tags }: any) => tags && (
                    <Badge key={tags.id} variant="outline" className="ml-2 text-xs py-0 px-1.5"
                      style={{ borderColor: tags.color, color: tags.color }}>
                      {tags.name}
                    </Badge>
                  ))}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className={cn('flex items-center gap-1 text-xs', PRIORITY_COLORS[task.priority] ?? '')}>
                    <AlertCircle size={12} />
                    {task.priority}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {task.assignee_agent ? (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Bot size={12} />
                      <span>{task.assignee_agent.name}</span>
                    </div>
                  ) : task.assignee_user ? (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assignee_user.raw_user_meta_data?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {task.assignee_user.email.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {task.due_date ? format(new Date(task.due_date), 'MM/dd') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
