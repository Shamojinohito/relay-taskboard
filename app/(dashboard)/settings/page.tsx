import ClaudeCodeSetup from '@/components/settings/claude-code-setup'
import CodexSetup from '@/components/settings/codex-setup'
import DispatcherWorkflow from '@/components/settings/dispatcher-workflow'
import { ChatGPTLogo, ClaudeLogo } from '@/components/settings/brand-logos'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Workflow } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Settings size={18} className="text-primary" />
            Settings
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure external agent clients and operational access.
          </p>
        </div>
      </div>

      <Tabs defaultValue="codex">
        <TabsList>
          <TabsTrigger value="codex">
            <ChatGPTLogo />
            Codex
          </TabsTrigger>
          <TabsTrigger value="claude">
            <ClaudeLogo />
            Claude Code
          </TabsTrigger>
          <TabsTrigger value="workflow">
            <Workflow size={14} />
            Workflow
          </TabsTrigger>
        </TabsList>
        <TabsContent value="codex" className="mt-4">
          <CodexSetup />
        </TabsContent>
        <TabsContent value="claude" className="mt-4">
          <ClaudeCodeSetup />
        </TabsContent>
        <TabsContent value="workflow" className="mt-4">
          <DispatcherWorkflow />
        </TabsContent>
      </Tabs>
    </div>
  )
}
