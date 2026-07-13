'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { CalendarCheck } from 'lucide-react'
import TaskDetailPanel from '@/components/tasks/task-detail-panel'
import TaskListView from '@/components/tasks/task-list-view'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useTodayRealtime } from '@/hooks/use-realtime'
import type { TaskStatus } from '@/lib/task-status'

interface TodayTask {
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

export default function TodayPage() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()
  useTodayRealtime()

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const { data: tasks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['today-tasks', todayStr],
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
        .not('due_date', 'is', null)
        .lte('due_date', todayStr)
        .is('parent_task_id', null)
        .order('due_date', { ascending: true })

      if (error) throw error
      return (data ?? []) as TodayTask[]
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
      await queryClient.cancelQueries({ queryKey: ['today-tasks'] })
      const previousTasks = queryClient.getQueryData(['today-tasks', todayStr])
      queryClient.setQueryData(['today-tasks', todayStr], (current: unknown) => {
        if (!Array.isArray(current)) return current
        return current.map((task: TodayTask) =>
          task.id === taskId ? { ...task, status } : task
        )
      })
      return { previousTasks }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['today-tasks', todayStr], context.previousTasks)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
      const task = (tasks as TodayTask[]).find(t => t.id === variables.taskId)
      if (task) queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] })
    },
  })

  const changeStatus = (taskId: string, status: TaskStatus) => {
    updateStatus.mutate({ taskId, status })
  }

  const openTasks = (tasks as TodayTask[]).filter(task => task.status !== 'done')
  const overdueCount = openTasks.filter(task => (task.due_date ?? '') < todayStr).length
  const dueTodayCount = openTasks.length - overdueCount

  const selectedTask = tasks.find(task => task.id === selectedTaskId)

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-background/70 px-4 py-4 backdrop-blur sm:px-6">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <CalendarCheck size={19} className="text-primary" />
              Today
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Tasks due today or overdue, across all projects.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <Badge variant="outline" className="border-rose-500/50 px-2.5 py-1 text-rose-500">
                {overdueCount} overdue
              </Badge>
            )}
            <Badge variant="outline" className="px-2.5 py-1">{dueTodayCount} due today</Badge>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <TaskListView
            tasks={tasks as any[]}
            isLoading={isLoading}
            error={error as Error | null}
            onRetry={() => refetch()}
            onTaskClick={setSelectedTaskId}
            onStatusChange={changeStatus}
            showProject
            defaultSortKey="due_date"
            emptyMessage="Nothing due today. Enjoy the clear runway."
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
    </div>
  )
}
