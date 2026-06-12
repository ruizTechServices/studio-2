import type {
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
import { parseArchivePolicy } from '@/lib/intake/archive/policy'
import { scanWorkerRepository } from '@/lib/intake/worker/repository'
import { processPhase3Archive } from '@/lib/intake/worker/processor'
import { logInfo, logWarn } from '@/lib/logger/server'

const HARD_SCAN_DEADLINE_MS = 10 * 60 * 1_000

export async function runWorkerOnce(
  config: WorkerConfig,
  dependencies: {
    readonly repository?: ScanWorkerRepository
    readonly processor?: ScanProcessor
    readonly now?: () => Date
    readonly signal?: AbortSignal
  } = {}
): Promise<WorkerRunResult> {
  const repository = dependencies.repository ?? scanWorkerRepository
  const processor = dependencies.processor ?? processPhase3Archive
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

  const controller = new AbortController()
  const abortFromDependency = () =>
    controller.abort(
      dependencies.signal?.reason ??
        new WorkerFailure('worker_shutdown', 'Scan worker shutdown was requested.', true)
    )
  dependencies.signal?.addEventListener('abort', abortFromDependency, { once: true })
  if (dependencies.signal?.aborted) {
    abortFromDependency()
  }
  let deadlineMs = HARD_SCAN_DEADLINE_MS
  try {
    deadlineMs = parseArchivePolicy(claim.limits).scanDurationMaxMinutes * 60 * 1_000
  } catch {
    // The processor reports invalid persisted limits through the normal safe failure path.
  }
  const deadline = setTimeout(
    () =>
      controller.abort(
        new WorkerFailure(
          'scan_deadline_exceeded',
          'Scan processing exceeded the allowed duration.',
          true
        )
      ),
    deadlineMs
  )
  const heartbeatInterval = setInterval(() => {
    void repository
      .heartbeatScan(claim.scanId, config.workerId, config.leaseSeconds)
      .then((accepted) => {
        if (!accepted) {
          controller.abort(
            new WorkerFailure(
              'lease_lost',
              'Scan lease is no longer owned by this worker.',
              true
            )
          )
        }
      })
      .catch(() => {
        controller.abort(
          new WorkerFailure(
            'worker_repository_unavailable',
            'Scan queue persistence is unavailable.',
            true
          )
        )
      })
  }, Math.max(5_000, Math.floor((config.leaseSeconds * 1_000) / 3)))

  try {
    const completion = await processor(claim, {
      repository,
      workerId: config.workerId,
      signal: controller.signal,
    })
    if (controller.signal.aborted) {
      throw controller.signal.reason
    }
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
    const failure = classifyWorkerFailure(
      controller.signal.aborted ? controller.signal.reason : error
    )

    if (failure.code === 'lease_lost') {
      return { outcome: 'lease_lost', scanId: claim.scanId, failure }
    }

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
  } finally {
    clearTimeout(deadline)
    clearInterval(heartbeatInterval)
    dependencies.signal?.removeEventListener('abort', abortFromDependency)
  }
}
