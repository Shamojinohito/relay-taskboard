import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface AgentRun {
  id: string
  agent_id: string
  trigger: string
  status: string
  summary: string | null
  started_at: string
  finished_at: string | null
}

export function useAgentRuns() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient() as any

  const { data: runs = [], isLoading, error, refetch } = useQuery({
    queryKey: ['agent-runs'],
    queryFn: async (): Promise<AgentRun[]> => {
      const { data, error } = await supabase
        .from('agent_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  return { runs, isLoading, error, refetch }
}
