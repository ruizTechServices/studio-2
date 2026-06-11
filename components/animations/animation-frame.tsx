import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface AnimationFrameProps {
  readonly children: ReactNode
  readonly className?: string
  readonly label: string
  readonly decorative?: boolean
}

export function AnimationFrame({
  children,
  className,
  label,
  decorative = false,
}: AnimationFrameProps) {
  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-lg border bg-background',
        className
      )}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      {children}
    </div>
  )
}
