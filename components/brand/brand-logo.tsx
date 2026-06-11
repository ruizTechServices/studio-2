import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

interface BrandLogoProps {
  readonly className?: string
  readonly compact?: boolean
}

export function BrandLogo({ className, compact = false }: BrandLogoProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-2.5 text-foreground', className)}
      aria-label={compact ? siteConfig.name : undefined}
    >
      <svg
        viewBox="0 0 32 32"
        className="size-7 shrink-0"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          rx="8"
          className="fill-foreground"
        />
        <path
          d="M9 23V11h7.5a5.5 5.5 0 0 1 0 11H13"
          fill="none"
          stroke="var(--background)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m18 20 5 4"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="9" cy="11" r="2" fill="#2563eb" />
        <circle cx="23" cy="24" r="2" fill="#2563eb" />
      </svg>
      {!compact && (
        <span className="text-sm font-semibold tracking-tight">
          {siteConfig.name}
        </span>
      )}
    </span>
  )
}
