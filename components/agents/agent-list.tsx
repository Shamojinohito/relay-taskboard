'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Bot, Plus, Key, Copy } from 'lucide-react'

interface Agent {
  id: string
  name: string
  type: string
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  planner: 'bg-purple-500/20 text-purple-300',
  tech_lead: 'bg-blue-500/20 text-blue-300',
  worker: 'bg-green-500/20 text-green-300',
  custom: 'bg-orange-500/20 text-orange-300',
}

export function AgentList({
  agents,
  isLoading,
  error,
  onRetry,
}: {
  agents: Agent[]
  isLoading?: boolean
  error?: Error | null
  onRetry?: () => void
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<'planner' | 'tech_lead' | 'worker' | 'custom'>('worker')
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const queryClient = useQueryClient()

  const createAgent = async () => {
    if (!name.trim()) return
    setLoading(true)
    const rawKey = `sk-agent-${crypto.randomUUID()}`

    // Hash the key before storing
    const encoder = new TextEncoder()
    const data = encoder.encode(rawKey)
    const hash = await crypto.subtle.digest('SHA-256', data)
    const hashedKey = Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    const { error } = await (supabase.from('agents') as any)
      .insert({ name: name.trim(), type, api_key: hashedKey })
    if (error) {
      alert(`Agent creation failed: ${error.message}`)
      setLoading(false)
      return
    }
    setNewApiKey(rawKey)
    queryClient.invalidateQueries({ queryKey: ['agents'] })
    setLoading(false)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold">Agents</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} className="mr-1" /> New Agent
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <Skeleton key={i} className="h-[60px] w-full rounded-lg" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>Failed to load agents: {error.message}</p>
          {onRetry && (
            <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      ) : agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No agents yet. Use &ldquo;New Agent&rdquo; above to register one.
        </div>
      ) : (
        <div className="space-y-2">
          {agents.map(agent => (
            <div key={agent.id} className="flex items-center gap-3 p-3 border border-border rounded-lg">
              <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center">
                <Bot size={16} className="text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[agent.type] ?? TYPE_COLORS.custom}`}>
                    {agent.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Created {new Date(agent.created_at).toLocaleDateString()}
                </p>
              </div>
              <Key size={14} className="text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={v => { setCreateOpen(v); if (!v) { setNewApiKey(null); setName('') } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Agent</DialogTitle>
          </DialogHeader>

          {newApiKey ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Agent created. Copy this API key — it won't be shown again.
              </p>
              <div className="flex items-center gap-2 bg-secondary p-3 rounded-lg">
                <code className="text-xs flex-1 break-all">{newApiKey}</code>
                <Button size="icon" variant="ghost" className="h-7 w-7 flex-shrink-0"
                  onClick={() => navigator.clipboard.writeText(newApiKey)}>
                  <Copy size={14} />
                </Button>
              </div>
              <Button className="w-full" onClick={() => { setCreateOpen(false); setNewApiKey(null); setName('') }}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. PlannerAgent" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={v => v && setType(v as typeof type)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planner">Planner</SelectItem>
                      <SelectItem value="tech_lead">Tech Lead</SelectItem>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={createAgent} disabled={loading || !name.trim()}>Create</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
