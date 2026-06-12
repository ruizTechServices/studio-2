import type {
  SafeWorkerFailure,
  ScanClaim,
  ScanCompletion,
  ScanWorkerRepository,
  WorkerConfig,
} from '@/lib/intake/worker/contracts'
import { WorkerFailure } from '@/lib/intake/worker/failures'
import { createServiceRoleClient } from '@/lib/server'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getClient() {
  try {
    return createServiceRoleClient()
  } catch {
    throw new WorkerFailure(
      'worker_repository_unavailable',
      'Scan queue persistence is unavailable.',
      true
    )
  }
}

function parseClaim(data: unknown): ScanClaim | null {
  const row: unknown = Array.isArray(data) ? data[0] : data

  if (row === null || row === undefined) {
    return null
  }

  if (
    !isRecord(row) ||
    typeof row.scan_id !== 'string' ||
    typeof row.project_id !== 'string' ||
    typeof row.owner !== 'string' ||
    typeof row.repository !== 'string' ||
    (row.default_branch !== null && typeof row.default_branch !== 'string') ||
    (row.requested_ref !== null && typeof row.requested_ref !== 'string') ||
    row.status !== 'validating' ||
    !Number.isInteger(row.attempt_count) ||
    !isRecord(row.limits) ||
    typeof row.lease_expires_at !== 'string'
  ) {
    throw new WorkerFailure(
      'worker_invalid_response',
      'Scan queue returned an invalid response.',
      true
    )
  }

  return {
    scanId: row.scan_id,
    projectId: row.project_id,
    owner: row.owner,
    repository: row.repository,
    defaultBranch: row.default_branch,
    requestedRef: row.requested_ref,
    status: row.status,
    attemptCount: row.attempt_count as number,
    limits: row.limits,
    leaseExpiresAt: row.lease_expires_at,
  }
}

async function callBooleanRpc(
  name: string,
  parameters: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await getClient().rpc(name, parameters)

  if (error) {
    throw new WorkerFailure(
      'worker_repository_unavailable',
      'Scan queue persistence is unavailable.',
      true
    )
  }

  if (typeof data !== 'boolean') {
    throw new WorkerFailure(
      'worker_invalid_response',
      'Scan queue returned an invalid response.',
      true
    )
  }

  return data
}

export const scanWorkerRepository: ScanWorkerRepository = {
  async claimNextScan(config: WorkerConfig): Promise<ScanClaim | null> {
    const { data, error } = await getClient().rpc(
      'claim_next_scan',
      {
        p_worker_id: config.workerId,
        p_lease_seconds: config.leaseSeconds,
        p_max_attempts: config.maxAttempts,
      }
    )

    if (error) {
      throw new WorkerFailure(
        'worker_repository_unavailable',
        'Scan queue persistence is unavailable.',
        true
      )
    }

    return parseClaim(data)
  },

  heartbeatScan(scanId, workerId, leaseSeconds) {
    return callBooleanRpc('heartbeat_scan', {
      p_scan_id: scanId,
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    })
  },

  transitionScanStage(scanId, workerId, status) {
    return callBooleanRpc('transition_scan_stage', {
      p_scan_id: scanId,
      p_worker_id: workerId,
      p_status: status,
    })
  },

  beginScanInventory(scanId, workerId) {
    return callBooleanRpc('begin_scan_inventory', {
      p_scan_id: scanId,
      p_worker_id: workerId,
    })
  },

  persistScanFilesBatch(scanId, workerId, files) {
    return callBooleanRpc('persist_scan_files_batch', {
      p_scan_id: scanId,
      p_worker_id: workerId,
      p_files: files,
    })
  },

  releaseScanForRetry(scanId, workerId, nextAttemptAt, failure) {
    return callBooleanRpc('release_scan_for_retry', {
      p_scan_id: scanId,
      p_worker_id: workerId,
      p_next_attempt_at: nextAttemptAt,
      p_safe_error_code: failure.code,
      p_safe_error_message: failure.message,
    })
  },

  failScan(scanId, workerId, failure: SafeWorkerFailure) {
    return callBooleanRpc('fail_scan', {
      p_scan_id: scanId,
      p_worker_id: workerId,
      p_safe_error_code: failure.code,
      p_safe_error_message: failure.message,
    })
  },

  completeScan(scanId, workerId, completion: ScanCompletion) {
    return callBooleanRpc('finalize_phase_3_scan', {
      p_scan_id: scanId,
      p_project_id: completion.projectId,
      p_worker_id: workerId,
      p_status: completion.status,
      p_default_branch: completion.defaultBranch,
      p_resolved_ref: completion.resolvedRef,
      p_source_commit_sha: completion.sourceCommitSha,
      p_expected_file_count: completion.expectedFileCount,
      p_statistics: completion.statistics,
      p_warnings: completion.warnings,
    })
  },
}
