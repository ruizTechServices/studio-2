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
    return callBooleanRpc('complete_scan', {
      p_scan_id: scanId,
      p_worker_id: workerId,
      p_status: completion.status,
      p_statistics: completion.statistics,
      p_warnings: completion.warnings,
    })
  },
}
