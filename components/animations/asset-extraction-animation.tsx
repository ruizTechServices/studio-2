import { AnimationFrame } from './animation-frame'
import styles from './animations.module.css'

interface AssetExtractionAnimationProps {
  readonly className?: string
  readonly decorative?: boolean
}

const assets = ['Component', 'Utility', 'Pattern'] as const
const sourceLines = ['w-[91%]', 'w-[82%]', 'w-[73%]', 'w-[64%]'] as const

export function AssetExtractionAnimation({
  className,
  decorative = false,
}: AssetExtractionAnimationProps) {
  return (
    <AnimationFrame
      className={className}
      label="Reusable components, utilities, and patterns being extracted from a codebase"
      decorative={decorative}
    >
      <div className="grid min-h-44 grid-cols-[1fr_auto_1fr] items-center gap-3 p-4">
        <div className="space-y-2">
          {sourceLines.map((width) => (
            <span
              key={width}
              className={`${width} block h-2 rounded-full bg-muted`}
            />
          ))}
        </div>
        <div className={`${styles.extractor} h-24 w-px bg-blue-600`} />
        <div className="space-y-2">
          {assets.map((asset, index) => (
            <div
              key={asset}
              className={`${styles.extractedAsset} ${styles[`delay${index + 1}`]} rounded-md border bg-card px-2.5 py-2 font-mono text-[10px] text-muted-foreground`}
            >
              {asset}
            </div>
          ))}
        </div>
      </div>
    </AnimationFrame>
  )
}
