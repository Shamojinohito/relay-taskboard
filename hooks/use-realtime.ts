import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export function useTasksRealtime(projectId: string) {
  const queryClient = useQueryClient()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(`tasks:${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      }, (payload) => {
        const queryKey = ['tasks', projectId]

        if (payload.eventType === 'INSERT') {
          queryClient.setQueryData(queryKey, (current: unknown) => {
            if (!Array.isArray(current)) return current
            if (payload.new.parent_task_id || current.some((task: any) => task.id === payload.new.id)) {
              return current
            }
            return [...current, { ...payload.new, task_tags: [], assignee_agent: null }]
          })
          queryClient.invalidateQueries({ queryKey })
          return
        }

        if (payload.eventType === 'UPDATE') {
          queryClient.setQueryData(queryKey, (current: unknown) => {
            if (!Array.isArray(current)) return current
            return current.map((task: any) =>
              task.id === payload.new.id ? { ...task, ...payload.new } : task
            )
          })
          queryClient.invalidateQueries({ queryKey })
          return
        }

        if (payload.eventType === 'DELETE') {
          queryClient.setQueryData(queryKey, (current: unknown) => {
            if (!Array.isArray(current)) return current
            return current.filter((task: any) => task.id !== payload.old.id)
          })
          return
        }

        queryClient.invalidateQueries({ queryKey })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [projectId, queryClient])
}
