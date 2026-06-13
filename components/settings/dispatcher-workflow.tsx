'use client'

import { AlertTriangle, Clock3, ListChecks, ShieldCheck, Workflow } from 'lucide-react'
import CopyableCode from '@/components/settings/copyable-code'

export default function DispatcherWorkflow() {
  const schedulerRun = `export RELAY_BASE_URL="https://relay-taskboard.vercel.app"
export RELAY_RUN_TOKEN="<same value as RELAY_RUN_TOKEN or AGENT_API_SECRET>"

curl -X POST "$RELAY_BASE_URL/api/v1/agent/run" \\
  -H "X-Relay-Run-Token: $RELAY_RUN_TOKEN"`

  const agentPatch = `curl -X PATCH "$RELAY_BASE_URL/api/v1/agent/tasks/<task-id>" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "status": "blocked",
    "blocked_reason": "Need human approval before changing production settings.",
    "handoff_note": "Implementation is ready. Human owner should approve the production change.",
    "comment": "Blocked and handed off for approval."
  }'`

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card/80 p-4">
        <div className="mb-2 flex items-center gap-2">
          <Workflow size={16} className="text-primary" />
          <h2 className="text-base font-semibold">Dispatcher Workflow</h2>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Relay is the hosted board and Agent API for AI-human handoff. It records assignments and decisions; local desktop apps, Codex, and Claude Code claim work from Relay instead of receiving pushed jobs from the web app.
        </p>
      </div>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <ListChecks size={15} className="text-primary" />
          <h3 className="text-sm font-medium">Task contract</h3>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          <li><span className="text-foreground">Action Type</span> classifies the work as content, research, review, publish, setup, or other.</li>
          <li><span className="text-foreground">Handoff Note</span> records what changed, why it changed, and what the next owner should do.</li>
          <li><span className="text-foreground">Blocked Reason</span> is required operational context when a task is moved to Blocked.</li>
          <li><span className="text-foreground">Comments</span> remain the activity log for detailed agent instructions and decisions.</li>
        </ul>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <Clock3 size={15} className="text-primary" />
          <h3 className="text-sm font-medium">Dispatcher rules</h3>
        </div>
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          <li>Agents should process one assigned task at a time, prioritized as urgent, high, medium, then low.</li>
          <li>Relay does not actively dispatch work to agents from the browser. Agents or local schedulers call the Agent API and claim work.</li>
          <li>Tasks tagged <span className="text-foreground">dispatcher-lock</span> should not be automatically executed.</li>
          <li>Tasks with no status change for 72 hours are marked Blocked with the reason <span className="text-foreground">72時間変化なし</span>.</li>
        </ul>
        <CopyableCode>{schedulerRun}</CopyableCode>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <AlertTriangle size={15} className="text-primary" />
          <h3 className="text-sm font-medium">Blocked handoff example</h3>
        </div>
        <CopyableCode>{agentPatch}</CopyableCode>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-card/60 p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-primary" />
          <h3 className="text-sm font-medium">Security posture</h3>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          Agent access uses the JWT-based Agent API. Keep agent API keys out of source control, assign separate agents for Codex and Claude Code, and write explicit task comments describing allowed and forbidden actions before a local agent claims work.
        </p>
      </section>
    </div>
  )
}
