'use client'

import Link from 'next/link'
import { LayoutGrid, List, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProjectViewHeaderProps {
  projectId: string
  projectName?: string
  activeView: 'board' | 'list'
  onAddTask: () => void
}

export default function ProjectViewHeader({
  projectId,
  projectName,
  activeView,
  onAddTask,
}: ProjectViewHeaderProps) {
  const views = [
    {
      key: 'board',
      label: 'Board',
      href: `/projects/${projectId}`,
      icon: LayoutGrid,
    },
    {
      key: 'list',
      label: 'List',
      href: `/projects/${projectId}/list`,
      icon: List,
    },
  ] as const

  return (
    <div className="flex items-center justify-between border-b border-border bg-background/70 px-6 py-4 backdrop-blur">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {projectName ?? 'Loading...'}
          </h1>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
            Project
          </span>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {views.map(({ key, label, href, icon: Icon }) => {
            const active = activeView === key
            const className = cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'h-7 gap-1.5',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            )
            const content = (
              <>
                <Icon size={13} />
                {label}
              </>
            )

            return active ? (
              <span key={key} aria-current="page" className={className}>
                {content}
              </span>
            ) : (
              <Link key={key} href={href} className={className}>
                {content}
              </Link>
            )
          })}
        </div>
      </div>
      <Button size="sm" className="gap-1.5" onClick={onAddTask}>
        <Plus size={14} />
        Add Task
      </Button>
    </div>
  )
}
