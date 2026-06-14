import type { FileCategory } from '@/lib/intake/archive/contracts'
import type { ScanStatus } from '@/lib/intake/contracts'
import type { SystemMapSeed } from '@/lib/intake/system-map/contracts'
import type { SymbolSummary } from '@/lib/intake/symbols/contracts'

export interface ScanResultsProject {
  readonly id: string
  readonly owner: string
  readonly repository: string
  readonly canonicalUrl: string
  readonly defaultBranch: string | null
}

export interface ScanResultsScan {
  readonly id: string
  readonly projectId: string
  readonly requestedRef: string | null
  readonly resolvedRef: string | null
  readonly sourceCommitSha: string | null
  readonly status: ScanStatus
  readonly statistics: Readonly<Record<string, unknown>>
  readonly warnings: readonly string[]
  readonly safeError: string | null
  readonly createdAt: string
  readonly startedAt: string | null
  readonly completedAt: string | null
  readonly updatedAt: string
}

export interface ScanInventoryPreviewRow {
  readonly relativePath: string
  readonly language: string | null
  readonly category: FileCategory
  readonly sizeBytes: number
  readonly isText: boolean
}

export interface ScanResults {
  readonly project: ScanResultsProject
  readonly scan: ScanResultsScan
  readonly inventoryPreview: readonly ScanInventoryPreviewRow[]
  readonly systemMapSeed: SystemMapSeed
  readonly symbolSummary: SymbolSummary
}

export interface CountItem {
  readonly label: string
  readonly count: number
}
