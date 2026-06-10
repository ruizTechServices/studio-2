import { AnimationFrame } from './animation-frame'
import styles from './animations.module.css'

interface SystemMapAnimationProps {
  readonly className?: string
  readonly decorative?: boolean
}

export function SystemMapAnimation({
  className,
  decorative = false,
}: SystemMapAnimationProps) {
  return (
    <AnimationFrame
      className={className}
      label="Animated system map showing connected application modules"
      decorative={decorative}
    >
      <svg viewBox="0 0 320 180" className="h-auto w-full" aria-hidden="true">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-border"
        >
          <path d="M60 46 150 88 260 42" className={styles.mapPath} />
          <path d="m60 46 28 92 62-50 76 52 34-98" className={styles.mapPathAlt} />
          <path d="m88 138 138 2" className={styles.mapPath} />
        </g>
        <g>
          <circle cx="60" cy="46" r="11" className={`${styles.mapNode} fill-blue-600`} />
          <circle cx="150" cy="88" r="15" className={`${styles.mapNode} ${styles.delay2} fill-foreground`} />
          <circle cx="260" cy="42" r="10" className={`${styles.mapNode} ${styles.delay3} fill-blue-600`} />
          <circle cx="88" cy="138" r="9" className={`${styles.mapNode} ${styles.delay4} fill-muted-foreground`} />
          <circle cx="226" cy="140" r="12" className={`${styles.mapNode} ${styles.delay1} fill-foreground`} />
        </g>
      </svg>
    </AnimationFrame>
  )
}
