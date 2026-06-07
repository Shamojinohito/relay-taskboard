'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CreateProjectDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const supabase = createClient()

  const handleCreate = async () => {
    if (!name.trim()) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ name: name.trim(), description: description.trim() || null, owner_id: user.id } as any)
      .select()
      .single()

    if (!error && project) {
      await supabase.from('project_members').insert({
        project_id: (project as any).id, user_id: user.id, role: 'owner'
      } as any)
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setName('')
      setDescription('')
      onOpenChange(false)
    }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Project name" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optional description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={loading || !name.trim()}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
