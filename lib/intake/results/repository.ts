import { isScanStatus } from '@/lib/intake/policy'
import type {
  ScanInventoryPreviewRow,
  ScanResults,
} from '@/lib/intake/results/contracts'
import { createServiceRoleClient } from '@/lib/server'
import { buildSystemMapSeed } from '@/lib/intake/system-map/build-system-map-seed'
import type { SystemMapFileMetadata } from '@/lib/intake/system-map/contracts'
import {
  SYMBOL_KINDS,
  type ScanSymbol,
  type SymbolSummary,
} from '@/lib/intake/symbols/contracts'
import {
  REUSABLE_ASSET_KINDS,
  type ReusableAssetCandidate,
  type ReusableAssetSummary,
} from '@/lib/intake/reusable-assets/contracts'

const CATEGORIES = new Set(['test', 'docs', 'config', 'asset', 'source', 'other'])
const SYSTEM_MAP_FILE_LIMIT = 20_000
const SYMBOL_PREVIEW_LIMIT = 25
const SYMBOL_CONFIDENCES = new Set(['high', 'medium', 'low'])
const SYMBOL_CATEGORIES = new Set(['dependency', 'declaration', 'routing', 'unknown'])
const REUSABLE_ASSET_PREVIEW_LIMIT = 12
const REUSABLE_SYMBOL_KINDS = new Set(['function', 'component', 'hook', 'api_handler', 'type', 'constant', 'unknown'])
const EMPTY_REUSABLE_ASSET_SUMMARY: ReusableAssetSummary = { total: 0, preview: [] }

export class ScanResultsPersistenceError extends Error {
  constructor(
    readonly code: 'config' | 'database' | 'invalid_response',
    message: string
  ) {
    super(message)
    this.name = 'ScanResultsPersistenceError'
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

function nullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value)
}

function parsePreview(value: unknown): readonly ScanInventoryPreviewRow[] | null {
  if (!Array.isArray(value) || value.length > 50) return null
  const rows: ScanInventoryPreviewRow[] = []
  for (const row of value) {
    if (
      !isRecord(row) ||
      typeof row.relativePath !== 'string' ||
      !nullableString(row.language) ||
      typeof row.category !== 'string' ||
      !CATEGORIES.has(row.category) ||
      !Number.isSafeInteger(row.sizeBytes) ||
      (row.sizeBytes as number) < 0 ||
      typeof row.isText !== 'boolean'
    ) {
      return null
    }
    rows.push({
      relativePath: row.relativePath,
      language: row.language,
      category: row.category as ScanInventoryPreviewRow['category'],
      sizeBytes: row.sizeBytes as number,
      isText: row.isText,
    })
  }
  return rows
}

function parseSystemMapFiles(value: unknown): readonly SystemMapFileMetadata[] | null {
  if (!Array.isArray(value) || value.length > SYSTEM_MAP_FILE_LIMIT) return null
  const files: SystemMapFileMetadata[] = []
  for (const file of value) {
    if (
      !isRecord(file) ||
      typeof file.relativePath !== 'string' ||
      typeof file.name !== 'string' ||
      !nullableString(file.extension) ||
      !nullableString(file.language) ||
      typeof file.category !== 'string' ||
      !CATEGORIES.has(file.category) ||
      !Number.isSafeInteger(file.sizeBytes) ||
      (file.sizeBytes as number) < 0 ||
      !Number.isSafeInteger(file.depth) ||
      (file.depth as number) < 0 ||
      typeof file.isText !== 'boolean'
    ) {
      return null
    }
    files.push({
      relativePath: file.relativePath,
      name: file.name,
      extension: file.extension,
      language: file.language,
      category: file.category as SystemMapFileMetadata['category'],
      sizeBytes: file.sizeBytes as number,
      depth: file.depth as number,
      isText: file.isText,
    })
  }
  return files
}

function parseSymbolSummary(value: unknown): SymbolSummary | null {
  if (!isRecord(value) || !isRecord(value.counts) || !Array.isArray(value.preview)) return null
  if (!Number.isSafeInteger(value.total) || (value.total as number) < 0) return null
  const counts = {} as Record<(typeof SYMBOL_KINDS)[number], number>
  for (const kind of SYMBOL_KINDS) {
    const count = value.counts[kind]
    if (!Number.isSafeInteger(count) || (count as number) < 0) return null
    counts[kind] = count as number
  }
  if (value.preview.length > SYMBOL_PREVIEW_LIMIT) return null
  const preview: ScanSymbol[] = []
  for (const symbol of value.preview) {
    if (
      !isRecord(symbol) ||
      typeof symbol.relativePath !== 'string' ||
      typeof symbol.kind !== 'string' ||
      !SYMBOL_KINDS.includes(symbol.kind as (typeof SYMBOL_KINDS)[number]) ||
      typeof symbol.name !== 'string' ||
      typeof symbol.exported !== 'boolean' ||
      !nullableString(symbol.importSource) ||
      !(symbol.lineStart === null || (Number.isSafeInteger(symbol.lineStart) && (symbol.lineStart as number) >= 1)) ||
      !(symbol.lineEnd === null || (Number.isSafeInteger(symbol.lineEnd) && (symbol.lineEnd as number) >= 1)) ||
      typeof symbol.confidence !== 'string' ||
      !SYMBOL_CONFIDENCES.has(symbol.confidence) ||
      typeof symbol.category !== 'string' ||
      !SYMBOL_CATEGORIES.has(symbol.category)
    ) return null
    preview.push(symbol as unknown as ScanSymbol)
  }
  return { total: value.total as number, counts, preview }
}

function parseReusableAssetSummary(value: unknown): ReusableAssetSummary | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.total) || (value.total as number) < 0) return null
  if (!Array.isArray(value.preview) || value.preview.length > REUSABLE_ASSET_PREVIEW_LIMIT) return null
  const preview: ReusableAssetCandidate[] = []
  for (const candidate of value.preview) {
    if (
      !isRecord(candidate) ||
      typeof candidate.scanId !== 'string' ||
      typeof candidate.projectId !== 'string' ||
      typeof candidate.relativePath !== 'string' ||
      typeof candidate.symbolName !== 'string' ||
      typeof candidate.symbolKind !== 'string' ||
      !REUSABLE_SYMBOL_KINDS.has(candidate.symbolKind) ||
      typeof candidate.assetKind !== 'string' ||
      !REUSABLE_ASSET_KINDS.includes(candidate.assetKind as (typeof REUSABLE_ASSET_KINDS)[number]) ||
      typeof candidate.exported !== 'boolean' ||
      typeof candidate.confidence !== 'string' ||
      !SYMBOL_CONFIDENCES.has(candidate.confidence) ||
      !Number.isSafeInteger(candidate.reuseScore) ||
      (candidate.reuseScore as number) < 0 ||
      (candidate.reuseScore as number) > 100 ||
      !Array.isArray(candidate.reasons) ||
      candidate.reasons.length < 1 ||
      candidate.reasons.length > 3 ||
      !candidate.reasons.every((reason) => typeof reason === 'string')
    ) return null
    preview.push(candidate as unknown as ReusableAssetCandidate)
  }
  return { total: value.total as number, preview }
}

function parseResults(
  value: unknown,
  systemMapFiles: readonly SystemMapFileMetadata[],
  symbolSummary: SymbolSummary,
  reusableAssetSummary: ReusableAssetSummary
): ScanResults | null {
  if (!isRecord(value) || !isRecord(value.project) || !isRecord(value.scan)) return null
  const { project, scan } = value
  const preview = parsePreview(value.inventoryPreview)
  if (
    preview === null ||
    typeof project.id !== 'string' ||
    typeof project.owner !== 'string' ||
    typeof project.repository !== 'string' ||
    typeof project.canonicalUrl !== 'string' ||
    !nullableString(project.defaultBranch) ||
    typeof scan.id !== 'string' ||
    typeof scan.projectId !== 'string' ||
    !nullableString(scan.requestedRef) ||
    !nullableString(scan.resolvedRef) ||
    !nullableString(scan.sourceCommitSha) ||
    !isScanStatus(scan.status) ||
    !isRecord(scan.statistics) ||
    !Array.isArray(scan.warnings) ||
    !scan.warnings.every((warning) => typeof warning === 'string') ||
    !nullableString(scan.safeError) ||
    !isTimestamp(scan.createdAt) ||
    !nullableTimestamp(scan.startedAt) ||
    !nullableTimestamp(scan.completedAt) ||
    !isTimestamp(scan.updatedAt)
  ) {
    return null
  }
  return {
    project: {
      id: project.id,
      owner: project.owner,
      repository: project.repository,
      canonicalUrl: project.canonicalUrl,
      defaultBranch: project.defaultBranch,
    },
    scan: {
      id: scan.id,
      projectId: scan.projectId,
      requestedRef: scan.requestedRef,
      resolvedRef: scan.resolvedRef,
      sourceCommitSha: scan.sourceCommitSha,
      status: scan.status,
      statistics: scan.statistics,
      warnings: scan.warnings as string[],
      safeError: scan.safeError,
      createdAt: scan.createdAt,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      updatedAt: scan.updatedAt,
    },
    inventoryPreview: preview,
    systemMapSeed: buildSystemMapSeed(scan.id, scan.projectId, systemMapFiles),
    symbolSummary,
    reusableAssetSummary,
  }
}

export async function getScanResults(
  projectId: string,
  scanId: string
): Promise<ScanResults | null> {
  let client
  try {
    client = createServiceRoleClient()
  } catch {
    throw new ScanResultsPersistenceError('config', 'Scan results are unavailable.')
  }

  const { data, error } = await client.rpc('get_scan_results', {
    p_project_id: projectId,
    p_scan_id: scanId,
    p_preview_limit: 50,
  })
  if (error) {
    throw new ScanResultsPersistenceError('database', 'Scan results are unavailable.')
  }
  if (data === null) return null

  const systemMapResponse = await client.rpc('get_scan_system_map_files', {
    p_project_id: projectId,
    p_scan_id: scanId,
  })
  if (systemMapResponse.error) {
    throw new ScanResultsPersistenceError('database', 'Scan results are unavailable.')
  }
  const systemMapFiles = parseSystemMapFiles(systemMapResponse.data)
  if (systemMapFiles === null) {
    throw new ScanResultsPersistenceError(
      'invalid_response',
      'Scan results returned an invalid response.'
    )
  }

  const symbolResponse = await client.rpc('get_scan_symbol_summary', {
    p_project_id: projectId,
    p_scan_id: scanId,
    p_preview_limit: SYMBOL_PREVIEW_LIMIT,
  })
  if (symbolResponse.error) {
    throw new ScanResultsPersistenceError('database', 'Scan results are unavailable.')
  }
  const symbolSummary = parseSymbolSummary(symbolResponse.data)
  if (symbolSummary === null) {
    throw new ScanResultsPersistenceError(
      'invalid_response',
      'Scan results returned an invalid response.'
    )
  }

  const reusableAssetResponse = await client.rpc('get_scan_reusable_asset_summary', {
    p_project_id: projectId,
    p_scan_id: scanId,
    p_preview_limit: REUSABLE_ASSET_PREVIEW_LIMIT,
  })
  const reusableAssetSummary = reusableAssetResponse.error
    ? EMPTY_REUSABLE_ASSET_SUMMARY
    : parseReusableAssetSummary(reusableAssetResponse.data)
  if (reusableAssetSummary === null) {
    throw new ScanResultsPersistenceError(
      'invalid_response',
      'Scan results returned an invalid response.'
    )
  }

  const parsed = parseResults(data, systemMapFiles, symbolSummary, reusableAssetSummary)
  if (!parsed || parsed.project.id !== projectId || parsed.scan.id !== scanId) {
    throw new ScanResultsPersistenceError(
      'invalid_response',
      'Scan results returned an invalid response.'
    )
  }
  return parsed
}
