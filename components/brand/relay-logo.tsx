import { cn } from '@/lib/utils'

export default function RelayLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn('size-5', className)}
      fill="none"
    >
      <rect x="2.5" y="2.5" width="27" height="27" rx="8" className="fill-primary/10 stroke-primary/25" />
      <path
        d="M9 12.2h8.9c2.8 0 5.1 2.2 5.1 5s-2.3 5-5.1 5H12"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 8.8 9 12.2l5 3.4M18 19.1l5 3.2-5 3.4"
        className="stroke-primary"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16" cy="16" r="2.2" className="fill-primary" />
    </svg>
  )
}
