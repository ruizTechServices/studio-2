import type {
  ProjectImportResponse,
  ScanStatusResponse,
} from '@/lib/intake/contracts'
import {
  isScanStatus,
  isSummaryStatus,
} from '@/lib/intake/policy'
import type { ValidatedImportRequest } from '@/lib/intake/validation'
import { createServiceRoleClient } from '@/lib/server'

export class IntakePersistenceError extends Error {
  constructor(
    readonly code: 'config' | 'database' | 'invalid_response',
    message: string
  ) {
    super(message)
    this.name = 'IntakePersistenceError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function getClient() {
  try {
    return createServiceRoleClient()
  } catch (error) {
    throw new IntakePersistenceError(
      'config',
      error instanceof Error ? error.message : 'Supabase is not configured'
    )
  }
}

export async function createQueuedScan(
  input: ValidatedImportRequest,
  limits: Record<string, number>
): Promise<ProjectImportResponse> {
  const { data, error } = await getClient().rpc('create_project_scan', {
    p_owner: input.owner,
    p_repository: input.repository,
    p_canonical_url: input.canonicalUrl,
    p_requested_ref: input.ref,
    p_limits: limits,
  })

  if (error) {
    throw new IntakePersistenceError('database', error.message)
  }

  const row: unknown = Array.isArray(data) ? data[0] : data

  if (
    !isRecord(row) ||
    typeof row.project_id !== 'string' ||
    typeof row.scan_id !== 'string' ||
    row.status !== 'queued'
  ) {
    throw new IntakePersistenceError(
      'invalid_response',
      'Project intake returned an invalid response'
    )
  }

  return {
    projectId: row.project_id,
    scanId: row.scan_id,
    status: 'queued',
  }
}

export async function getScanStatus(
  scanId: string
): Promise<ScanStatusResponse | null> {
  const { data, error } = await getClient()
    .from('scans')
    .select(
      'id, project_id, status, statistics, warnings, safe_error_message, summary_status'
    )
    .eq('id', scanId)
    .maybeSingle()

  if (error) {
    throw new IntakePersistenceError('database', error.message)
  }

  if (data === null) {
    return null
  }

  const row: unknown = data

  if (
    !isRecord(row) ||
    typeof row.id !== 'string' ||
    typeof row.project_id !== 'string' ||
    !isScanStatus(row.status) ||
    !isRecord(row.statistics) ||
    !isStringArray(row.warnings) ||
    (row.safe_error_message !== null &&
      typeof row.safe_error_message !== 'string') ||
    !isSummaryStatus(row.summary_status)
  ) {
    throw new IntakePersistenceError(
      'invalid_response',
      'Scan status returned an invalid response'
    )
  }

  return {
    scanId: row.id,
    projectId: row.project_id,
    status: row.status,
    statistics: row.statistics,
    warnings: row.warnings,
    safeError: row.safe_error_message,
    summaryStatus: row.summary_status,
  }
}
