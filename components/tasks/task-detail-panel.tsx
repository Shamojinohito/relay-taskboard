// components/tasks/task-detail-panel.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarDays, LinkIcon, MessageSquareText, Network, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import SubtaskList from './subtask-list'
import CommentList from './comment-list'
import DatePicker from './date-picker'
import AssigneeSelect, { fromAssigneeValue, toAssigneeValue } from './assignee-select'
import TaskLinks from './task-links'
import { TASK_STATUSES, getTaskStatusLabel } from '@/lib/task-status'
import { TASK_ACTION_TYPES, TASK_ACTION_TYPE_LABELS } from '@/lib/task-workflow'

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  action_type: string
  handoff_note: string | null
  blocked_reason: string | null
  due_date: string | null
  assignee_user_id: string | null
  assignee_agent_id: string | null
  task_tags: { tags: { id: string; name: string; color: string } | null }[]
}

interface TaskDetailPanelProps {
  taskId: string
  projectId: string
  onClose: () => void
}

export default function TaskDetailPanel({ taskId, projectId, onClose }: TaskDetailPanelProps) {
  const [task, setTask] = useState<Task | null>(null)
  const supabase = createClient()
  const queryClient = useQueryClient()

  useEffect(() => {
    ;(supabase.from('tasks') as any)
      .select('*, task_tags(tag_id, tags(id, name, color))')
      .eq('id', taskId)
      .single()
      .then(({ data }: { data: Task | null }) => setTask(data))
  }, [taskId])

  const updateTask = async (updates: Partial<Task>) => {
    await (supabase.from('tasks') as any).update(updates).eq('id', taskId)
    setTask(prev => prev ? { ...prev, ...updates } : prev)
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] })
    queryClient.invalidateQueries({ queryKey: ['my-tasks'] })
  }

  if (!task) return null

  return (
    <div className="flex h-full w-[27rem] flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-background/55 p-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">{getTaskStatusLabel(task.status)}</Badge>
          <Badge variant="secondary" className="capitalize">{task.priority}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-5 p-5">
          <Input
            value={task.title}
            onChange={e => setTask(prev => prev ? { ...prev, title: e.target.value } : prev)}
            onBlur={e => updateTask({ title: e.target.value })}
            className="h-auto border-transparent bg-transparent px-0 text-lg font-semibold leading-tight focus-visible:ring-0"
          />

          <Textarea
            value={task.description ?? ''}
            onChange={e => setTask(prev => prev ? { ...prev, description: e.target.value } : prev)}
            onBlur={e => updateTask({ description: e.target.value || null })}
            placeholder="Add description..."
            className="min-h-24 resize-none rounded-lg border-border bg-background/45 text-sm text-muted-foreground focus-visible:ring-1"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-background/35 p-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={task.status} onValueChange={v => v && updateTask({ status: v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{getTaskStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Action Type</span>
              <Select value={task.action_type ?? 'other'} onValueChange={v => v && updateTask({ action_type: v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_ACTION_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{TASK_ACTION_TYPE_LABELS[type]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Priority</span>
              <Select value={task.priority} onValueChange={v => v && updateTask({ priority: v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['low','medium','high','urgent'].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border bg-background/35 p-3">
            <span className="text-xs text-muted-foreground">Handoff Note</span>
            <Textarea
              value={task.handoff_note ?? ''}
              onChange={e => setTask(prev => prev ? { ...prev, handoff_note: e.target.value } : prev)}
              onBlur={e => updateTask({ handoff_note: e.target.value || null })}
              placeholder="What changed, why, and what the next owner should do..."
              className="min-h-20 resize-none rounded-md bg-background/55 text-sm"
              rows={3}
            />
          </div>

          {task.status === 'blocked' && (
            <div className="space-y-2 rounded-lg border border-rose-500/35 bg-rose-500/10 p-3">
              <span className="text-xs text-rose-200">Blocked Reason</span>
              <Textarea
                value={task.blocked_reason ?? ''}
                onChange={e => setTask(prev => prev ? { ...prev, blocked_reason: e.target.value } : prev)}
                onBlur={e => updateTask({ blocked_reason: e.target.value || null })}
                placeholder="Why this task is blocked..."
                className="min-h-20 resize-none rounded-md border-rose-500/30 bg-background/70 text-sm"
                rows={3}
              />
            </div>
          )}

          <div className="space-y-1 rounded-lg border border-border bg-background/35 p-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays size={12} />
              Due Date
            </span>
            <DatePicker
              value={task.due_date ?? ''}
              onChange={value => updateTask({ due_date: value || null })}
            />
          </div>

          <div className="space-y-1 rounded-lg border border-border bg-background/35 p-3">
            <span className="text-xs text-muted-foreground">Assignee</span>
            <AssigneeSelect
              value={toAssigneeValue(task.assignee_user_id, task.assignee_agent_id)}
              onChange={value => updateTask(fromAssigneeValue(value))}
              className="h-8 w-full text-sm"
            />
          </div>

          {task.task_tags.length > 0 && (
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Tags</span>
              <div className="flex flex-wrap gap-1">
                {task.task_tags.map(({ tags }) => tags && (
                  <Badge key={tags.id} variant="outline" style={{ borderColor: tags.color, color: tags.color }}>
                    {tags.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <LinkIcon size={12} />
              Reference Links
            </span>
            <TaskLinks taskId={taskId} projectId={projectId} />
          </div>

          <Separator />

          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Network size={12} />
              Subtasks
            </span>
            <SubtaskList parentTaskId={taskId} projectId={projectId} />
          </div>

          <Separator />

          <div className="space-y-2">
            <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <MessageSquareText size={12} />
              Comments & Instructions
            </span>
            <CommentList taskId={taskId} />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
