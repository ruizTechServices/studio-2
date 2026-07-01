import { REUSABLE_ASSET_KINDS } from '@/lib/intake/reusable-assets/contracts'
import { createServiceRoleClient } from '@/lib/server'
import type {
  PromoteShelfAssetRequest,
  ShelfAsset,
  ShelfName,
  ShelfSearchQuery,
  ShelfSearchResult,
} from '@/lib/shelves/contracts'
import { SHELF_NAMES, SHELF_VISIBILITIES } from '@/lib/shelves/contracts'

const CONFIDENCES = new Set(['high', 'medium', 'low'])
const SYMBOL_KINDS = new Set([
  'function',
  'component',
  'hook',
  'api_handler',
  'type',
  'constant',
  'unknown',
])
const COMMIT_SHA = /^[0-9a-f]{40}$/

export class ShelfPersistenceError extends Error {
  constructor(
    readonly code: 'config' | 'database' | 'invalid_response',
    message: string
  ) {
    super(message)
    this.name = 'ShelfPersistenceError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isBoundedInteger(value: unknown, minimum: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum
}

function isNullableLine(value: unknown): value is number | null {
  return value === null || (Number.isSafeInteger(value) && (value as number) >= 1)
}

function isStringArray(
  value: unknown,
  maximumLength: number
): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.length <= maximumLength &&
    value.every((entry) => typeof entry === 'string')
  )
}

export function parseShelfAsset(value: unknown): ShelfAsset | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.shelf !== 'string' ||
    !(SHELF_NAMES as readonly string[]).includes(value.shelf) ||
    typeof value.assetKind !== 'string' ||
    !(REUSABLE_ASSET_KINDS as readonly string[]).includes(value.assetKind) ||
    typeof value.symbolName !== 'string' ||
    typeof value.symbolKind !== 'string' ||
    !SYMBOL_KINDS.has(value.symbolKind) ||
    typeof value.exported !== 'boolean' ||
    typeof value.sourceOwner !== 'string' ||
    typeof value.sourceRepository !== 'string' ||
    typeof value.sourceCanonicalUrl !== 'string' ||
    typeof value.sourceCommitSha !== 'string' ||
    !COMMIT_SHA.test(value.sourceCommitSha) ||
    typeof value.relativePath !== 'string' ||
    !isNullableLine(value.lineStart) ||
    !isNullableLine(value.lineEnd) ||
    !nullableString(value.projectId) ||
    !isBoundedInteger(value.reuseScore, 0) ||
    (value.reuseScore as number) > 100 ||
    typeof value.confidence !== 'string' ||
    !CONFIDENCES.has(value.confidence) ||
    !isStringArray(value.reasons, 3) ||
    (value.reasons as string[]).length < 1 ||
    !isStringArray(value.tags, 8) ||
    !nullableString(value.notes) ||
    typeof value.visibility !== 'string' ||
    !(SHELF_VISIBILITIES as readonly string[]).includes(value.visibility) ||
    !isBoundedInteger(value.version, 1) ||
    !isBoundedInteger(value.timesPromoted, 1) ||
    !isTimestamp(value.createdAt) ||
    !isTimestamp(value.updatedAt)
  ) {
    return null
  }

  return {
    id: value.id,
    shelf: value.shelf as ShelfAsset['shelf'],
    assetKind: value.assetKind as ShelfAsset['assetKind'],
    symbolName: value.symbolName,
    symbolKind: value.symbolKind as ShelfAsset['symbolKind'],
    exported: value.exported,
    sourceOwner: value.sourceOwner,
    sourceRepository: value.sourceRepository,
    sourceCanonicalUrl: value.sourceCanonicalUrl,
    sourceCommitSha: value.sourceCommitSha,
    relativePath: value.relativePath,
    lineStart: value.lineStart,
    lineEnd: value.lineEnd,
    projectId: value.projectId,
    reuseScore: value.reuseScore,
    confidence: value.confidence as ShelfAsset['confidence'],
    reasons: value.reasons as readonly string[],
    tags: value.tags as readonly string[],
    notes: value.notes,
    visibility: value.visibility as ShelfAsset['visibility'],
    version: value.version,
    timesPromoted: value.timesPromoted,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  }
}

function parseShelfCounts(
  value: unknown
): Readonly<Partial<Record<ShelfName, number>>> | null {
  if (!isRecord(value)) return null
  const counts: Partial<Record<ShelfName, number>> = {}
  for (const [shelf, count] of Object.entries(value)) {
    if (
      !(SHELF_NAMES as readonly string[]).includes(shelf) ||
      !isBoundedInteger(count, 0)
    ) {
      return null
    }
    counts[shelf as ShelfName] = count
  }
  return counts
}

function parseSearchResult(value: unknown): ShelfSearchResult | null {
  if (!isRecord(value) || !isBoundedInteger(value.total, 0)) return null
  const shelfCounts = parseShelfCounts(value.shelfCounts)
  if (shelfCounts === null || !Array.isArray(value.assets)) return null
  const assets: ShelfAsset[] = []
  for (const asset of value.assets) {
    const parsed = parseShelfAsset(asset)
    if (parsed === null) return null
    assets.push(parsed)
  }
  return { total: value.total, shelfCounts, assets }
}

function requireClient() {
  try {
    return createServiceRoleClient()
  } catch {
    throw new ShelfPersistenceError('config', 'The shelf library is unavailable.')
  }
}

/**
 * Promotes one scan candidate into the durable shelf library. Returns null
 * when the candidate, completed scan, or project no longer exists.
 */
export async function promoteReusableAssetToShelf(
  request: PromoteShelfAssetRequest
): Promise<ShelfAsset | null> {
  const client = requireClient()
  const { data, error } = await client.rpc('promote_reusable_asset_to_shelf', {
    p_scan_id: request.scanId,
    p_project_id: request.projectId,
    p_relative_path: request.relativePath,
    p_symbol_name: request.symbolName,
    p_symbol_kind: request.symbolKind,
    p_shelf: request.shelf,
    p_tags: request.tags,
    p_notes: request.notes,
  })
  if (error) {
    throw new ShelfPersistenceError('database', 'The shelf library is unavailable.')
  }
  if (data === null) return null
  const asset = parseShelfAsset(data)
  if (asset === null) {
    throw new ShelfPersistenceError(
      'invalid_response',
      'The shelf library returned an invalid response.'
    )
  }
  return asset
}

export async function searchShelfAssets(
  query: ShelfSearchQuery
): Promise<ShelfSearchResult> {
  const client = requireClient()
  const { data, error } = await client.rpc('search_shelf_assets', {
    p_query: query.query,
    p_shelf: query.shelf,
    p_limit: query.limit,
  })
  if (error) {
    throw new ShelfPersistenceError('database', 'The shelf library is unavailable.')
  }
  const result = parseSearchResult(data)
  if (result === null) {
    throw new ShelfPersistenceError(
      'invalid_response',
      'The shelf library returned an invalid response.'
    )
  }
  return result
}
