import { jwtVerify } from 'jose'
import { createServiceClient } from '@/lib/supabase/service'

export type AgentScope =
  | 'read:tasks'
  | 'write:tasks'
  | 'write:comments'
  | 'claim:tasks'
  | 'run:dispatcher'

export interface AgentTokenPayload {
  agentId: string
  agentName: string
  scopes: AgentScope[]
}

export async function getAgentFromRequest(request: Request, requiredScopes: AgentScope[] = []) {
  const auth = request.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null

  try {
    const secret = new TextEncoder().encode(process.env.AGENT_API_SECRET!)
    const { payload } = await jwtVerify(auth.slice(7), secret)
    const agent = payload as unknown as AgentTokenPayload
    const scopes = Array.isArray(agent.scopes) ? agent.scopes : []
    const allowed = requiredScopes.every(scope => scopes.includes(scope))
    return allowed ? { ...agent, scopes } : null
  } catch {
    return null
  }
}

export async function writeAgentAuditLog({
  action,
  agentId,
  idempotencyKey,
  metadata,
  requestId,
  taskId,
}: {
  action: string
  agentId: string
  idempotencyKey?: string | null
  metadata?: Record<string, unknown>
  requestId?: string | null
  taskId?: string | null
}) {
  const supabase = createServiceClient()
  await (supabase.from('agent_audit_logs') as any).insert({
    action,
    agent_id: agentId,
    idempotency_key: idempotencyKey ?? null,
    metadata: metadata ?? {},
    request_id: requestId ?? null,
    task_id: taskId ?? null,
  })
}
