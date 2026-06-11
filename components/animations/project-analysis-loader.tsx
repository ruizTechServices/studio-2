import { cn } from '@/lib/utils'

import styles from './animations.module.css'

interface ProjectAnalysisLoaderProps {
  readonly className?: string
  readonly label?: string
}

export function ProjectAnalysisLoader({
  className,
  label = 'Analyzing project',
}: ProjectAnalysisLoaderProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-2 text-xs text-muted-foreground', className)}
      role="status"
    >
      <span className="inline-flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3].map((dot) => (
          <span
            key={dot}
            className={`${styles.analysisDot} ${styles[`delay${dot}`]} size-1.5 rounded-full bg-blue-600`}
          />
        ))}
      </span>
      {label}
    </span>
  )
}
