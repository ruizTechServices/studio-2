import { AnimationFrame } from './animation-frame'
import styles from './animations.module.css'

interface RepoScanAnimationProps {
  readonly className?: string
  readonly decorative?: boolean
}

const files = [
  { name: 'app/', width: 'w-20' },
  { name: 'components/', width: 'w-28' },
  { name: 'lib/', width: 'w-16' },
  { name: 'config/', width: 'w-24' },
] as const

export function RepoScanAnimation({
  className,
  decorative = false,
}: RepoScanAnimationProps) {
  return (
    <AnimationFrame
      className={className}
      label="Repository folders being scanned in sequence"
      decorative={decorative}
    >
      <div className="relative space-y-2 p-4">
        {files.map((file, index) => (
          <div
            key={file.name}
            className="flex items-center gap-3 rounded-md border bg-card px-3 py-2"
          >
            <span className="size-2 rounded-full bg-blue-600" />
            <span className="font-mono text-[11px] text-muted-foreground">
              {file.name}
            </span>
            <span
              className={`${file.width} ml-auto h-1.5 rounded-full bg-muted`}
            />
            <span
              className={`${styles.scanResult} ${styles[`delay${index + 1}`]}`}
            />
          </div>
        ))}
        <span className={styles.scanLine} aria-hidden="true" />
      </div>
    </AnimationFrame>
  )
}
