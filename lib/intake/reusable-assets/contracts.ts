import type { SymbolConfidence, SymbolKind } from '@/lib/intake/symbols/contracts'

export const REUSABLE_ASSET_KINDS = [
  'ui_component',
  'hook',
  'utility',
  'api_handler',
  'type_definition',
  'config_helper',
  'constant',
  'unknown',
] as const

export type ReusableAssetKind = (typeof REUSABLE_ASSET_KINDS)[number]
export type ReusableAssetSymbolKind = Exclude<SymbolKind, 'import' | 'export'>

export interface ReusableAssetCandidate {
  readonly scanId: string
  readonly projectId: string
  readonly relativePath: string
  readonly symbolName: string
  readonly symbolKind: ReusableAssetSymbolKind
  readonly assetKind: ReusableAssetKind
  readonly exported: boolean
  readonly confidence: SymbolConfidence
  readonly reuseScore: number
  readonly reasons: readonly string[]
}

export interface ReusableAssetSummary {
  readonly total: number
  readonly preview: readonly ReusableAssetCandidate[]
}
