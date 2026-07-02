/**
 * Phase 9 retrieval-on-demand contracts. A preview is fetched from GitHub at
 * the shelf asset's pinned commit, sliced in route-handler memory, and
 * returned to the local-only surface. Source contents are never persisted,
 * logged, or written to disk.
 */

export const RETRIEVAL_LIMITS = {
  maxFileBytes: 262_144,
  maxPreviewLines: 200,
  maxLineLengthChars: 500,
  requestTimeoutMs: 8_000,
} as const

export const RETRIEVAL_ERROR_CODES = [
  'not_found',
  'binary_file',
  'file_too_large',
  'github_rate_limited',
  'github_unavailable',
  'timeout',
] as const

export type RetrievalErrorCode = (typeof RETRIEVAL_ERROR_CODES)[number]

/** Provenance fields required to fetch one shelf asset's pinned source file. */
export interface ShelfAssetRetrievalPointer {
  readonly id: string
  readonly sourceOwner: string
  readonly sourceRepository: string
  readonly sourceCommitSha: string
  readonly relativePath: string
  readonly lineStart: number | null
  readonly lineEnd: number | null
  readonly symbolName: string
}

export interface SourcePreviewLine {
  readonly number: number
  readonly text: string
  readonly truncated: boolean
}

export interface ShelfSourcePreview {
  readonly assetId: string
  readonly symbolName: string
  readonly sourceOwner: string
  readonly sourceRepository: string
  readonly sourceCommitSha: string
  readonly relativePath: string
  readonly sourceUrl: string
  readonly totalLines: number
  readonly lineStart: number
  readonly lineEnd: number
  readonly truncatedByLineLimit: boolean
  readonly lines: readonly SourcePreviewLine[]
}
