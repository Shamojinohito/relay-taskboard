// hooks/use-tasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { TaskStatus } from '@/lib/task-status'

export type { TaskStatus }

export function useTasks(projectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const queryClient = useQueryClient()

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['tasks', projectId],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          project_id,
          parent_task_id,
          title,
          description,
          status,
          priority,
          action_type,
          handoff_note,
          blocked_reason,
          assignee_user_id,
          assignee_agent_id,
          due_date,
          position,
          created_at,
          updated_at,
          task_tags(tag_id, tags(id, name, color)),
          task_links(id, url, title),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .order('position', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!projectId,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
      if (error) throw error
    },
    onMutate: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const queryKey = ['tasks', projectId]
      await queryClient.cancelQueries({ queryKey })
      const previousTasks = queryClient.getQueryData(queryKey)

      queryClient.setQueryData(queryKey, (current: unknown) => {
        if (!Array.isArray(current)) return current
        return current.map((task: any) =>
          task.id === taskId ? { ...task, status } : task
        )
      })

      return { previousTasks }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  return { tasks, isLoading, error, updateStatus }
}
