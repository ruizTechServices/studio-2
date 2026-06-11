import { cn } from '@/lib/utils'

import styles from './animations.module.css'

interface PanelAmbientMotionProps {
  readonly className?: string
}

export function PanelAmbientMotion({ className }: PanelAmbientMotionProps) {
  return (
    <span
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden="true"
    >
      <span className={`${styles.ambientLine} absolute top-1/4 -left-12 h-px w-28 bg-blue-600/20`} />
      <span className={`${styles.ambientLineReverse} absolute right-0 bottom-1/3 h-px w-20 bg-foreground/10`} />
    </span>
  )
}
