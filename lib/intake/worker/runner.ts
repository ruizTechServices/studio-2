import type {
  ScanClaim,
  ScanProcessor,
  ScanWorkerRepository,
  WorkerConfig,
  WorkerRunResult,
} from '@/lib/intake/worker/contracts'
import {
  classifyWorkerFailure,
  shouldRetryFailure,
  WorkerFailure,
} from '@/lib/intake/worker/failures'
import { scanWorkerRepository } from '@/lib/intake/worker/repository'
import { logInfo, logWarn } from '@/lib/logger/server'

export async function processPhase2Placeholder(
  claim: ScanClaim
): Promise<never> {
  if (
    !claim.scanId ||
    !claim.projectId ||
    claim.attemptCount < 1 ||
    Object.keys(claim.limits).length === 0
  ) {
    throw new WorkerFailure(
      'invalid_scan_metadata',
      'Scan metadata is invalid.',
      false
    )
  }

  throw new WorkerFailure(
    'phase_3_not_implemented',
    'Repository intake is deferred until Phase 3.',
    false
  )
}

export async function runWorkerOnce(
  config: WorkerConfig,
  dependencies: {
    readonly repository?: ScanWorkerRepository
    readonly processor?: ScanProcessor
    readonly now?: () => Date
  } = {}
): Promise<WorkerRunResult> {
  const repository = dependencies.repository ?? scanWorkerRepository
  const processor = dependencies.processor ?? processPhase2Placeholder
  const now = dependencies.now ?? (() => new Date())
  const claim = await repository.claimNextScan(config)

  if (!claim) {
    return { outcome: 'idle' }
  }

  await logInfo({
    message: 'Intake worker claimed scan',
    context: {
      scanId: claim.scanId,
      workerId: config.workerId,
      attemptCount: claim.attemptCount,
    },
  })

  const heartbeatAccepted = await repository.heartbeatScan(
    claim.scanId,
    config.workerId,
    config.leaseSeconds
  )

  if (!heartbeatAccepted) {
    const failure = new WorkerFailure(
      'lease_lost',
      'Scan lease is no longer owned by this worker.',
      true
    )

    await logWarn({
      message: 'Intake worker lost scan lease',
      context: { scanId: claim.scanId, workerId: config.workerId },
    })

    return {
      outcome: 'lease_lost',
      scanId: claim.scanId,
      failure: classifyWorkerFailure(failure),
    }
  }

  try {
    const completion = await processor(claim)
    const completed = await repository.completeScan(
      claim.scanId,
      config.workerId,
      completion
    )

    if (!completed) {
      throw new WorkerFailure(
        'lease_lost',
        'Scan lease is no longer owned by this worker.',
        true
      )
    }

    await logInfo({
      message: 'Intake worker completed scan',
      context: { scanId: claim.scanId, workerId: config.workerId },
    })

    return { outcome: 'completed', scanId: claim.scanId }
  } catch (error) {
    const failure = classifyWorkerFailure(error)

    if (shouldRetryFailure(failure, claim.attemptCount, config.maxAttempts)) {
      const nextAttemptAt = new Date(
        now().getTime() + config.retryDelaySeconds * 1_000
      ).toISOString()
      const released = await repository.releaseScanForRetry(
        claim.scanId,
        config.workerId,
        nextAttemptAt,
        failure
      )

      if (released) {
        await logWarn({
          message: 'Intake worker scheduled scan retry',
          context: {
            scanId: claim.scanId,
            workerId: config.workerId,
            code: failure.code,
          },
        })

        return { outcome: 'retry_scheduled', scanId: claim.scanId, failure }
      }
    }

    const failed = await repository.failScan(
      claim.scanId,
      config.workerId,
      failure
    )

    if (!failed) {
      return { outcome: 'lease_lost', scanId: claim.scanId, failure }
    }

    await logWarn({
      message: 'Intake worker marked scan failed',
      context: {
        scanId: claim.scanId,
        workerId: config.workerId,
        code: failure.code,
      },
    })

    return { outcome: 'failed', scanId: claim.scanId, failure }
  }
}
