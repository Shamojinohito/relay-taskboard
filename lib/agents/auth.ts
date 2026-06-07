// lib/agents/auth.ts
import { createClient } from '@/lib/supabase/server'

export async function validateAgentApiKey(apiKey: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const hashedKey = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  const supabase = await createClient()
  const { data: agent, error } = await (supabase.from('agents') as any)
    .select('*')
    .eq('api_key', hashedKey)
    .single()

  if (error || !agent) return null
  return agent as { id: string; name: string; type: string; project_ids: string[] }
}
