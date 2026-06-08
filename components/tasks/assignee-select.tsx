'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'

export type AssigneeValue = `user:${string}` | `agent:${string}` | 'none'

interface Agent {
  id: string
  name: string
  type: string
}

interface AssigneeSelectProps {
  value: AssigneeValue
  onChange: (value: AssigneeValue) => void
  className?: string
}

export function toAssigneeValue(userId?: string | null, agentId?: string | null): AssigneeValue {
  if (agentId) return `agent:${agentId}`
  if (userId) return `user:${userId}`
  return 'none'
}

export function fromAssigneeValue(value: AssigneeValue) {
  if (value.startsWith('user:')) {
    return { assignee_user_id: value.slice(5), assignee_agent_id: null }
  }

  if (value.startsWith('agent:')) {
    return { assignee_user_id: null, assignee_agent_id: value.slice(6) }
  }

  return { assignee_user_id: null, assignee_agent_id: null }
}

export default function AssigneeSelect({ value, onChange, className }: AssigneeSelectProps) {
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null)
  const [agents, setAgents] = useState<Agent[]>([])
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let mounted = true

    async function loadOptions() {
      const [{ data: userData }, { data: agentData }] = await Promise.all([
        supabase.auth.getUser(),
        (supabase.from('agents') as any).select('id, name, type').order('created_at', { ascending: true }),
      ])

      if (!mounted) return
      setCurrentUser(userData.user ? { id: userData.user.id, email: userData.user.email } : null)
      setAgents(agentData ?? [])
    }

    loadOptions()
    return () => { mounted = false }
  }, [supabase])

  return (
    <Select value={value} onValueChange={next => next && onChange(next as AssigneeValue)}>
      <SelectTrigger className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {currentUser && (
          <SelectItem value={`user:${currentUser.id}`}>
            <UserRound size={14} />
            {currentUser.email ?? 'Me'}
          </SelectItem>
        )}
        {agents.map(agent => (
          <SelectItem key={agent.id} value={`agent:${agent.id}`}>
            <Bot size={14} />
            {agent.name} · {agent.type.replace('_', ' ')}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
