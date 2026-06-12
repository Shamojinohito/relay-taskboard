'use client'

import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function CopyableCode({ children }: { children: string }) {
  return (
    <div className="group relative rounded-lg border border-border bg-background/70 p-3">
      <pre className="overflow-x-auto whitespace-pre-wrap pr-9 text-xs leading-5 text-muted-foreground">
        <code>{children}</code>
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
        onClick={() => navigator.clipboard.writeText(children)}
        title="Copy"
      >
        <Copy size={13} />
      </Button>
    </div>
  )
}
