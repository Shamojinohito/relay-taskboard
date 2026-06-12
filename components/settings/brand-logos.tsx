import { cn } from '@/lib/utils'

interface BrandLogoProps {
  className?: string
}

export function ChatGPTLogo({ className }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-4', className)}
      fill="none"
    >
      <circle cx="12" cy="12" r="10" className="fill-emerald-500/15" />
      <g className="stroke-emerald-300" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 4.7c2.4 0 3.7 1.6 3.7 3.4 1.9.8 3 2.4 2.4 4.4-.6 2-2.4 2.8-4.1 2.6-1.2 1.6-3.1 2.2-4.8 1.2-1.7-1-2.1-2.9-1.4-4.4-.8-1.8-.4-3.7 1.4-4.7 1.1-.7 2-.7 2.8-.4" />
        <path d="M8 11.9l4-2.3 4 2.3" />
        <path d="M12 9.6v4.7l-3.9 2.2" />
        <path d="M12 14.3l4-2.3" />
        <path d="M15.7 8.1l-3.7 2.1" />
        <path d="M8.1 11.9l3.9 2.3 3.9-2.2" />
      </g>
    </svg>
  )
}

export function ClaudeLogo({ className }: BrandLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn('size-4', className)}
      fill="none"
    >
      <circle cx="12" cy="12" r="10" className="fill-orange-500/15" />
      <g className="fill-orange-300">
        <path d="M11.2 4.7h1.6l.45 5.3 4.55-2.75.8 1.4-4.85 2.25 4.85 2.25-.8 1.4-4.55-2.75-.45 5.3h-1.6l-.45-5.3-4.55 2.75-.8-1.4 4.85-2.25L5.4 8.65l.8-1.4L10.75 10l.45-5.3Z" />
        <circle cx="12" cy="11.9" r="1.35" className="fill-background" />
      </g>
    </svg>
  )
}
