'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Bot, Code2, Network, ShieldCheck } from 'lucide-react'
import RelayLogo from '@/components/brand/relay-logo'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const supabase = createClient()

  const signInWithGitHub = async () => {
    setLoading(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setMessage(error.message)
      setLoading(false)
    }
  }

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setMessage(error.message)
    setLoading(false)
  }

  const signUpWithEmail = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    setMessage(error ? error.message : 'Check your email for the confirmation link.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <RelayLogo className="size-10" />
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Relay</h1>
              <p className="text-sm text-muted-foreground">AI-human task relay operations</p>
            </div>
          </div>

          <div className="max-w-xl space-y-4">
            <p className="text-4xl font-semibold leading-tight tracking-tight text-foreground">
              Async handoff board for humans and AI agents.
            </p>
            <p className="text-base leading-7 text-muted-foreground">
              Relay keeps projects, tasks, approvals, links, and agent handoffs explicit so every worker knows the next move.
            </p>
          </div>

          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {[
              { icon: Bot, label: 'Agent relay' },
              { icon: Network, label: 'Project context' },
              { icon: ShieldCheck, label: 'Human approval' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="rounded-lg border border-border bg-card/70 px-3 py-3 text-sm text-muted-foreground">
                <Icon size={16} className="mb-2 text-primary" />
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="w-full justify-self-end rounded-xl border border-border bg-card/85 p-6 shadow-2xl shadow-black/25 backdrop-blur sm:max-w-md">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workspace access</p>
            <h2 className="mt-2 text-xl font-semibold">Sign in to continue</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use GitHub or your email credentials.</p>
          </div>

          <Button variant="outline" className="h-10 w-full gap-2" onClick={signInWithGitHub} disabled={loading}>
            <Code2 size={16} />
            Continue with GitHub
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form onSubmit={signInWithEmail} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={loading}>Sign In</Button>
              <Button type="button" variant="outline" className="flex-1"
                onClick={signUpWithEmail} disabled={loading}>Sign Up</Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
