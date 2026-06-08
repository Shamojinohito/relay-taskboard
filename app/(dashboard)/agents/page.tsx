'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AgentList } from '@/components/agents/agent-list'
import { AgentRunLog } from '@/components/agents/agent-run-log'
import { CodexSetup } from '@/components/agents/codex-setup'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

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

  const triggerManualRun = async () => {
    await fetch('/api/agent/run', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
    await loadRuns()
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Agents</h1>
        <Button size="sm" onClick={triggerManualRun}>
          <Play size={14} className="mr-1" /> Run Now
        </Button>
      </div>

      <Tabs defaultValue="agents">
        <TabsList>
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="codex">Codex Setup</TabsTrigger>
          <TabsTrigger value="runs">Run Log</TabsTrigger>
        </TabsList>
        <TabsContent value="agents" className="mt-4">
          <AgentList agents={agents} />
        </TabsContent>
        <TabsContent value="codex" className="mt-4">
          <CodexSetup />
        </TabsContent>
        <TabsContent value="runs" className="mt-4">
          <AgentRunLog runs={runs} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
