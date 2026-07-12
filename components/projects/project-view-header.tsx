'use client'

import Link from 'next/link'
import { LayoutGrid, List, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const PROJECT_VIEW_STORAGE_KEY = 'relay:project-view'

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
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background/70 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
            {projectName ?? 'Loading...'}
          </h1>
          <span className="hidden rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground sm:inline">
            Project
          </span>
        </div>
        <div className="flex w-fit gap-1 rounded-lg border border-border bg-card p-1">
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
              <Link
                key={key}
                href={href}
                className={className}
                onClick={() => {
                  try {
                    localStorage.setItem(PROJECT_VIEW_STORAGE_KEY, key)
                  } catch {
                    // storage unavailable (private mode etc.) — preference just won't stick
                  }
                }}
              >
                {content}
              </Link>
            )
          })}
        </div>
      </div>
      <Button size="sm" className="shrink-0 gap-1.5" onClick={onAddTask}>
        <Plus size={14} />
        <span className="hidden sm:inline">Add Task</span>
        <span className="sr-only sm:hidden">Add Task</span>
      </Button>
    </div>
  )
}
