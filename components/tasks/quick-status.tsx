'use client'

import { Check, ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  TASK_STATUSES,
  getTaskStatusDotColor,
  getTaskStatusLabel,
  type TaskStatus,
} from '@/lib/task-status'

interface TaskCompleteToggleProps {
  status: string
  onChange: (status: TaskStatus) => void
  className?: string
}

export function TaskCompleteToggle({ status, onChange, className }: TaskCompleteToggleProps) {
  const done = status === 'done'

  return (
    <button
      type="button"
      aria-label={done ? 'Reopen task' : 'Mark task as done'}
      title={done ? 'Reopen task' : 'Mark as done'}
      className={cn(
        // -m-2 + p-2 keeps a ~36px touch target without growing the layout
        '-m-2 inline-flex shrink-0 cursor-pointer items-center justify-center p-2',
        className
      )}
      onClick={event => {
        event.stopPropagation()
        onChange(done ? 'todo' : 'done')
      }}
    >
      <span
        className={cn(
          'inline-flex size-[18px] items-center justify-center rounded-full border transition-colors',
          done
            ? 'border-emerald-400 bg-emerald-400/20 text-emerald-400'
            : 'border-muted-foreground/50 text-transparent hover:border-emerald-400 hover:text-emerald-400/60'
        )}
      >
        <Check size={11} strokeWidth={3} />
      </span>
    </button>
  )
}

interface TaskStatusChipProps {
  status: string
  onChange: (status: TaskStatus) => void
  className?: string
}

export function TaskStatusChip({ status, onChange, className }: TaskStatusChipProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background/60 px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground',
          className
        )}
        onClick={event => event.stopPropagation()}
      >
        <span className={cn('size-2 rounded-full', getTaskStatusDotColor(status))} />
        {getTaskStatusLabel(status)}
        <ChevronDown size={11} className="text-muted-foreground/70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={event => event.stopPropagation()}>
        {TASK_STATUSES.map(value => (
          <DropdownMenuItem
            key={value}
            className="gap-2"
            onClick={() => {
              if (value !== status) onChange(value)
            }}
          >
            <span className={cn('size-2 rounded-full', getTaskStatusDotColor(value))} />
            {getTaskStatusLabel(value)}
            {value === status && <Check size={13} className="ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
