'use client'

import { useEffect, useState } from 'react'
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

interface AgentRun {
  id: string
  trigger: string
  status: string
  summary: string | null
  started_at: string
  finished_at: string | null
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [runs, setRuns] = useState<AgentRun[]>([])
  const supabase = createClient()

  const loadRuns = async () => {
    const { data } = await (supabase.from('agent_runs') as any)
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50)
    setRuns(data ?? [])
  }

  useEffect(() => {
    ;(supabase.from('agents') as any)
      .select('*')
      .order('created_at')
      .then(({ data }: { data: Agent[] | null }) => setAgents(data ?? []))
    loadRuns()
  }, [])

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
          <AgentList agents={agents} />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <AgentRunLog runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
