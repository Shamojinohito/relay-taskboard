'use client'

import { Bot, CheckCircle2, KeyRound, Workflow } from 'lucide-react'
import CopyableCode from '@/components/settings/copyable-code'
import { ChatGPTLogo } from '@/components/settings/brand-logos'

const WEB_APP_BASE_URL = 'https://relay-taskboard.vercel.app'

export default function CodexSetup() {
  const envExample = `export RELAY_BASE_URL="${WEB_APP_BASE_URL}"
export RELAY_AGENT_API_KEY="sk-agent-..."`

  const authExample = `curl -X POST "$RELAY_BASE_URL/api/v1/agent/auth" \\
  -H "Content-Type: application/json" \\
  -d '{"api_key":"'"$RELAY_AGENT_API_KEY"'"}'`

  const tasksExample = `TOKEN="<paste-token-from-auth-response>"

curl "$RELAY_BASE_URL/api/v1/agent/tasks?status=backlog" \\
  -H "Authorization: Bearer $TOKEN"`

  const claimExample = `curl -X POST "$RELAY_BASE_URL/api/v1/agent/claim-next-task" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)"`

  const updateExample = `curl -X PATCH "$RELAY_BASE_URL/api/v1/agent/tasks/<task-id>" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "status": "in_progress",
    "handoff_note": "Started implementation. Next owner should review the result.",
    "comment": "Codex picked this up and started work."
  }'`

  const codexPrompt = `You can access Relay through the Agent API.

Base URL: ${WEB_APP_BASE_URL}
Agent API key: use RELAY_AGENT_API_KEY from the local shell environment.

Workflow:
1. Authenticate with POST /api/v1/agent/auth.
2. Claim one assigned task with POST /api/v1/agent/claim-next-task.
3. Use status filters such as backlog, todo, in_progress, on_hold, blocked, in_review, done.
4. Process one assigned task at a time. Treat urgent, high, medium, then low as priority order.
5. When you start work, PATCH the task to in_progress and add a comment.
6. Record handoffs in handoff_note, blockers in blocked_reason, and detailed activity in comments.
7. Do not automatically execute tasks tagged dispatcher-lock.
8. Do not wait for Relay to push work to you. Relay is the shared board/API; local agents pull and claim assigned work.
9. If a human decision is needed, assign the task to the human owner or move it to blocked with a clear blocked_reason.`

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card/80 p-4">
        <div className="mb-2 flex items-center gap-2">
          <ChatGPTLogo className="size-5" />
          <h2 className="text-base font-semibold">Codex Setup</h2>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Codex runs outside the web app and connects to the hosted Relay Agent API. Relay does not push jobs to Codex; Codex claims assigned tasks from its local shell or desktop app workflow.
        </p>
      </div>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <Bot size={15} className="text-primary" />
          <h3 className="text-sm font-medium">1. Create a Codex agent</h3>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Open Agents, create an agent named <span className="text-foreground">CodexAgent</span>, choose Worker or Custom, and copy the API key shown after creation.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-primary" />
          <h3 className="text-sm font-medium">2. Set local agent variables</h3>
        </div>
        <CopyableCode>{envExample}</CopyableCode>
        <p className="text-xs leading-5 text-muted-foreground">
          Use the hosted URL for production agents. For local development only, replace it with http://localhost:3000.
        </p>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={15} className="text-primary" />
          <h3 className="text-sm font-medium">3. Verify API access</h3>
        </div>
        <CopyableCode>{authExample}</CopyableCode>
        <CopyableCode>{tasksExample}</CopyableCode>
        <CopyableCode>{claimExample}</CopyableCode>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <Workflow size={15} className="text-primary" />
          <h3 className="text-sm font-medium">4. Update tasks from Codex</h3>
        </div>
        <CopyableCode>{updateExample}</CopyableCode>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <h3 className="text-sm font-medium">Codex instruction snippet</h3>
        <CopyableCode>{codexPrompt}</CopyableCode>
      </section>
    </div>
  )
}
