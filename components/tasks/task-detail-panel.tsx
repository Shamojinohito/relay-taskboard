// components/tasks/task-detail-panel.tsx
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
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

interface Task {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
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
    <div className="w-96 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Badge variant="outline">{task.status.replace('_', ' ')}</Badge>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X size={16} />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Input
            value={task.title}
            onChange={e => setTask(prev => prev ? { ...prev, title: e.target.value } : prev)}
            onBlur={e => updateTask({ title: e.target.value })}
            className="text-base font-medium border-transparent bg-transparent px-0 focus-visible:ring-0"
          />

          <Textarea
            value={task.description ?? ''}
            onChange={e => setTask(prev => prev ? { ...prev, description: e.target.value } : prev)}
            onBlur={e => updateTask({ description: e.target.value || null })}
            placeholder="Add description..."
            className="border-transparent bg-transparent px-0 focus-visible:ring-0 text-sm text-muted-foreground resize-none"
            rows={3}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Status</span>
              <Select value={task.status} onValueChange={v => v && updateTask({ status: v })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['backlog','todo','in_progress','in_review','done'].map(s => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
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

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Due Date</span>
            <DatePicker
              value={task.due_date ?? ''}
              onChange={value => updateTask({ due_date: value || null })}
            />
          </div>

          <div className="space-y-1">
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
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Reference Links
            </span>
            <TaskLinks taskId={taskId} projectId={projectId} />
          </div>

          <Separator />

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Subtasks
            </span>
            <SubtaskList parentTaskId={taskId} projectId={projectId} />
          </div>

          <Separator />

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Comments & Instructions
            </span>
            <CommentList taskId={taskId} />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
