'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bot, CheckSquare, FolderKanban, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { useProjects } from '@/hooks/use-projects'
import CreateProjectDialog from '@/components/projects/create-project-dialog'
import { useState } from 'react'

export default function Sidebar() {
  const pathname = usePathname()
  const { projects, error } = useProjects()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            <Sparkles size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide text-sidebar-foreground">AirFlow</div>
            <div className="text-[11px] text-muted-foreground">AI task operations</div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-3">
          <Link href="/my-tasks">
            <div className={cn(
              "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
              pathname === '/my-tasks'
                ? "bg-primary/12 text-primary ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <CheckSquare size={16} />
              <span>My Tasks</span>
            </div>
          </Link>

          <div className="px-3 pb-1 pt-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Projects
              </span>
              <Button variant="ghost" size="icon-sm" className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => setCreateOpen(true)}>
                <Plus size={13} />
              </Button>
            </div>
          </div>

          {(projects as any[]).map(project => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer truncate transition-colors",
                pathname.startsWith(`/projects/${project.id}`)
                  ? "bg-primary/12 text-primary ring-1 ring-primary/20"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}>
                <FolderKanban size={15} className="flex-shrink-0" />
                <span className="truncate">{project.name}</span>
              </div>
            </Link>
          ))}

          {error && (
            <p className="px-3 py-2 text-xs text-destructive">
              Failed to load projects
            </p>
          )}

          <div className="px-3 pb-1 pt-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Agents
            </span>
          </div>

          <Link href="/agents">
            <div className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
              pathname === '/agents'
                ? "bg-primary/12 text-primary ring-1 ring-primary/20"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}>
              <Bot size={15} />
              <span>Agents</span>
            </div>
          </Link>
        </nav>
      </ScrollArea>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-lg border border-border/70 bg-background/45 px-3 py-2 text-xs text-muted-foreground">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-emerald-400" />
          Realtime sync active
        </div>
      </div>

      <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
    </aside>
  )
}
