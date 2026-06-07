// hooks/use-tasks.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done'

export function useTasks(projectId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any
  const queryClient = useQueryClient()

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', projectId],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags(tag_id, tags(id, name, color)),
          assignee_user:assignee_user_id(id, email, raw_user_meta_data),
          assignee_agent:assignee_agent_id(id, name, type)
        `)
        .eq('project_id', projectId)
        .is('parent_task_id', null)
        .order('position', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!projectId,
  })

  const updateStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: TaskStatus }) => {
      const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', projectId] }),
  })

  return { tasks, isLoading, updateStatus }
}
