'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { AgentList } from '@/components/agents/agent-list'
import { AgentRunLog } from '@/components/agents/agent-run-log'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Agent {
  id: string
  name: string
  type: string
  created_at: string
}

export default function AgentsPage() {
  const supabase = createClient()

  const { data: agents = [], isLoading, error, refetch } = useQuery({
    queryKey: ['agents'],
    queryFn: async (): Promise<Agent[]> => {
      const { data, error } = await (supabase.from('agents') as any)
        .select('*')
        .order('created_at')
      if (error) throw error
      return data ?? []
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage API identities for local agents. Relay stores assignments; agents claim work from outside the web app.
          </p>
        </div>
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="runs">Run Log</TabsTrigger>
        </TabsList>
        <TabsContent value="agents" className="mt-4">
          <AgentList agents={agents} isLoading={isLoading} error={error as Error | null} onRetry={refetch} />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <AgentRunLog />
        </TabsContent>
      </Tabs>
    </div>
  )
}
