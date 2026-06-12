import { isScanStatus } from '@/lib/intake/policy'
import type {
  ScanInventoryPreviewRow,
  ScanResults,
} from '@/lib/intake/results/contracts'
import { createServiceRoleClient } from '@/lib/server'

const CATEGORIES = new Set(['test', 'docs', 'config', 'asset', 'source', 'other'])

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

function parseResults(value: unknown): ScanResults | null {
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

  const parsed = parseResults(data)
  if (!parsed || parsed.project.id !== projectId || parsed.scan.id !== scanId) {
    throw new ScanResultsPersistenceError(
      'invalid_response',
      'Scan results returned an invalid response.'
    )
  }
  return parsed
}
