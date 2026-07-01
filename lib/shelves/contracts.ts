import type {
  ReusableAssetKind,
  ReusableAssetSymbolKind,
} from '@/lib/intake/reusable-assets/contracts'
import type { SymbolConfidence } from '@/lib/intake/symbols/contracts'

export const SHELF_NAMES = [
  'components',
  'hooks',
  'utilities',
  'api',
  'types',
  'config',
  'constants',
  'misc',
] as const

export type ShelfName = (typeof SHELF_NAMES)[number]

export const SHELF_VISIBILITIES = ['private', 'unlisted', 'public'] as const

export type ShelfVisibility = (typeof SHELF_VISIBILITIES)[number]

/**
 * A durable library entry. Provenance pointers only — source contents are
 * never persisted. `sourceCommitSha` pins the exact revision so retrieval at
 * reuse time is reproducible.
 */
export interface ShelfAsset {
  readonly id: string
  readonly shelf: ShelfName
  readonly assetKind: ReusableAssetKind
  readonly symbolName: string
  readonly symbolKind: ReusableAssetSymbolKind
  readonly exported: boolean
  readonly sourceOwner: string
  readonly sourceRepository: string
  readonly sourceCanonicalUrl: string
  readonly sourceCommitSha: string
  readonly relativePath: string
  readonly lineStart: number | null
  readonly lineEnd: number | null
  readonly projectId: string | null
  readonly reuseScore: number
  readonly confidence: SymbolConfidence
  readonly reasons: readonly string[]
  readonly tags: readonly string[]
  readonly notes: string | null
  readonly visibility: ShelfVisibility
  readonly version: number
  readonly timesPromoted: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ShelfSearchQuery {
  readonly query: string | null
  readonly shelf: ShelfName | null
  readonly limit: number
}

export interface ShelfSearchResult {
  readonly total: number
  readonly shelfCounts: Readonly<Partial<Record<ShelfName, number>>>
  readonly assets: readonly ShelfAsset[]
}

export interface PromoteShelfAssetRequest {
  readonly scanId: string
  readonly projectId: string
  readonly relativePath: string
  readonly symbolName: string
  readonly symbolKind: ReusableAssetSymbolKind
  readonly shelf: ShelfName | null
  readonly tags: readonly string[]
  readonly notes: string | null
}

export type ShelfField =
  | 'scanId'
  | 'projectId'
  | 'relativePath'
  | 'symbolName'
  | 'symbolKind'
  | 'shelf'
  | 'tags'
  | 'notes'
  | 'query'
  | 'limit'

export interface ShelfApiError {
  readonly error: string
  readonly field?: ShelfField
}
