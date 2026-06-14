export const SYMBOL_KINDS = [
  'import',
  'export',
  'function',
  'component',
  'hook',
  'api_handler',
  'type',
  'constant',
  'unknown',
] as const

export type SymbolKind = (typeof SYMBOL_KINDS)[number]
export type SymbolConfidence = 'high' | 'medium' | 'low'
export type SymbolCategory = 'dependency' | 'declaration' | 'routing' | 'unknown'

export interface ScanSymbol {
  readonly relativePath: string
  readonly kind: SymbolKind
  readonly name: string
  readonly exported: boolean
  readonly importSource: string | null
  readonly lineStart: number | null
  readonly lineEnd: number | null
  readonly confidence: SymbolConfidence
  readonly category: SymbolCategory
}

export interface SymbolSummary {
  readonly total: number
  readonly counts: Readonly<Record<SymbolKind, number>>
  readonly preview: readonly ScanSymbol[]
}
