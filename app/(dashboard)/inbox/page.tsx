'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isBefore, addDays, parseISO } from 'date-fns'
import { AlertTriangle, Inbox, Plus } from 'lucide-react'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskForm from '@/components/tasks/task-form'
import TaskListView from '@/components/tasks/task-list-view'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { useProjects } from '@/hooks/use-projects'
import { useInboxRealtime } from '@/hooks/use-realtime'
import type { TaskStatus } from '@/lib/task-status'

interface InboxTask {
  id: string
  project_id: string
  title: string
  status: string
  priority: string
  due_date: string | null
  handoff_note: string | null
  blocked_reason: string | null
  assignee_user_id: string | null
  assignee_agent_id: string | null
  project: { name: string } | null
  task_tags: { tags: { id: string; name: string; color: string } | null }[]
  assignee_agent: { name: string; type: string } | null
}

function isDueSoon(dueDate: string | null) {
  if (!dueDate) return false
  return isBefore(parseISO(dueDate), addDays(new Date(), 3))
}

function hasAssignee(task: InboxTask) {
  return Boolean(task.assignee_user_id || task.assignee_agent_id)
}

function getTriageReason(task: InboxTask) {
  if (task.status === 'blocked') return 'Blocked'
  if (!hasAssignee(task)) return 'Unassigned'
  if (!task.handoff_note?.trim()) return 'No handoff'
  if (isDueSoon(task.due_date)) return 'Due soon'
  if (task.status === 'in_review') return 'Needs review'
  return 'Watch'
}

export default function InboxPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { projects } = useProjects()
  const inboxProject = (projects as any[]).find(project => project.name === 'Inbox')
  useInboxRealtime()

  const { data: tasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['triage-inbox'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('tasks') as any)
        .select(`
          id,
          project_id,
          title,
          status,
          priority,
          due_date,
          handoff_note,
          blocked_reason,
          assignee_user_id,
          assignee_agent_id,
          project:project_id(name),
          task_tags(tag_id, tags(id, name, color)),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .neq('status', 'done')
        .is('parent_task_id', null)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as InboxTask[]
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('tasks') as any)
        .update({ status })
        .eq('id', taskId)
      if (error) throw error
    },
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['triage-inbox'] })
      const previousTasks = queryClient.getQueryData(['triage-inbox'])
      queryClient.setQueryData(['triage-inbox'], (current: unknown) => {
        if (!Array.isArray(current)) return current
        return current.map((task: InboxTask) =>
          task.id === taskId ? { ...task, status } : task
        )
      })
      return { previousTasks }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['triage-inbox'], context.previousTasks)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['triage-inbox'] })
      const task = (tasks as InboxTask[]).find(t => t.id === variables.taskId)
      if (task) queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] })
    },
  })

  const changeStatus = (taskId: string, status: TaskStatus) => {
    updateStatus.mutate({ taskId, status })
  }

  const triageTasks = useMemo(() => {
    return (tasks as InboxTask[]).filter(task =>
      task.status === 'blocked' ||
      task.status === 'in_review' ||
      !hasAssignee(task) ||
      !task.handoff_note?.trim() ||
      isDueSoon(task.due_date)
    )
  }, [tasks])

  const counts = {
    blocked: tasks.filter(task => task.status === 'blocked').length,
    unassigned: tasks.filter(task => !hasAssignee(task)).length,
    noHandoff: tasks.filter(task => !task.handoff_note?.trim()).length,
    dueSoon: tasks.filter(task => isDueSoon(task.due_date)).length,
    review: tasks.filter(task => task.status === 'in_review').length,
  }

  const selectedTask = tasks.find(task => task.id === selectedTaskId)

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <Inbox size={19} className="text-primary" />
                Inbox
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                Triage tasks that need context, ownership, human review, or unblock decisions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="px-2.5 py-1">{triageTasks.length} signals</Badge>
              <Button size="sm" className="shrink-0 gap-1.5" onClick={() => setCreateOpen(true)}>
                <Plus size={14} />
                <span className="hidden sm:inline">Add Task</span>
                <span className="sr-only sm:hidden">Add Task</span>
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              ['Blocked', counts.blocked, 'bg-rose-500'],
              ['Unassigned', counts.unassigned, 'bg-sky-400'],
              ['No Handoff', counts.noHandoff, 'bg-amber-400'],
              ['Due Soon', counts.dueSoon, 'bg-violet-400'],
              ['Review', counts.review, 'bg-emerald-400'],
            ].map(([label, count, color]) => (
              <div key={label} className="rounded-lg border border-border bg-card/70 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn('size-2 rounded-full', color as string)} />
                  {label}
                </div>
                <div className="mt-1 text-xl font-semibold">{count}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <TaskListView
            tasks={triageTasks as any[]}
            isLoading={isLoading}
            error={error as Error | null}
            onRetry={() => refetch()}
            onTaskClick={setSelectedTaskId}
            onStatusChange={changeStatus}
            showProject
            showStatusFilter={false}
            defaultSortKey="due_date"
            emptyMessage="No triage signals. The board is in a clean state."
            renderLeading={(task: any) => (
              <span className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/55 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                <AlertTriangle size={11} />
                {getTriageReason(task)}
              </span>
            )}
          />
        </div>
      </div>

      {selectedTaskId && selectedTask && (
        <TaskDetailPanel
          taskId={selectedTaskId}
          projectId={selectedTask.project_id}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {createOpen && (
        <TaskForm
          initialStatus="todo"
          defaultProjectId={inboxProject?.id}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  )
}
