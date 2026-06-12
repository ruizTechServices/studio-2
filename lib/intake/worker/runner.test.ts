import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  ScanClaim,
  ScanWorkerRepository,
  WorkerConfig,
} from '@/lib/intake/worker/contracts'
import { WorkerFailure } from '@/lib/intake/worker/failures'

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/logger/server', () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}))

import { runWorkerOnce } from '@/lib/intake/worker/runner'

const config: WorkerConfig = {
  workerId: 'worker-1',
  leaseSeconds: 120,
  maxAttempts: 3,
  pollMs: 5_000,
  retryDelaySeconds: 60,
}

const claim: ScanClaim = {
  scanId: '123e4567-e89b-42d3-a456-426614174001',
  projectId: '123e4567-e89b-42d3-a456-426614174000',
  owner: 'owner',
  repository: 'repository',
  defaultBranch: 'main',
  requestedRef: 'main',
  status: 'validating',
  attemptCount: 1,
  limits: { archiveEntriesMax: 20_000 },
  leaseExpiresAt: '2026-06-11T12:02:00.000Z',
}

function createRepository(
  overrides: Partial<ScanWorkerRepository> = {}
): ScanWorkerRepository {
  return {
    claimNextScan: vi.fn().mockResolvedValue(claim),
    heartbeatScan: vi.fn().mockResolvedValue(true),
    transitionScanStage: vi.fn().mockResolvedValue(true),
    beginScanInventory: vi.fn().mockResolvedValue(true),
    persistScanFilesBatch: vi.fn().mockResolvedValue(true),
    releaseScanForRetry: vi.fn().mockResolvedValue(true),
    failScan: vi.fn().mockResolvedValue(true),
    completeScan: vi.fn().mockResolvedValue(true),
    ...overrides,
  }
}

beforeEach(() => {
  mocks.logInfo.mockResolvedValue(undefined)
  mocks.logWarn.mockResolvedValue(undefined)
})

describe('runWorkerOnce', () => {
  it('returns idle without running a processor', async () => {
    const processor = vi.fn()
    const repository = createRepository({
      claimNextScan: vi.fn().mockResolvedValue(null),
    })

    await expect(
      runWorkerOnce(config, { repository, processor })
    ).resolves.toEqual({ outcome: 'idle' })
    expect(processor).not.toHaveBeenCalled()
  })

  it('completes a successful processor result', async () => {
    const repository = createRepository()
    const completion = {
      status: 'completed' as const,
      statistics: { files: 0 },
      warnings: [],
      projectId: claim.projectId,
      defaultBranch: 'main',
      resolvedRef: 'main',
      sourceCommitSha: 'a'.repeat(40),
      expectedFileCount: 0,
    }

    await expect(
      runWorkerOnce(config, {
        repository,
        processor: vi.fn().mockResolvedValue(completion),
      })
    ).resolves.toEqual({ outcome: 'completed', scanId: claim.scanId })
    expect(repository.completeScan).toHaveBeenCalledWith(
      claim.scanId,
      config.workerId,
      completion
    )
  })

  it('schedules retryable failures while attempts remain', async () => {
    const repository = createRepository()

    await expect(
      runWorkerOnce(config, {
        repository,
        processor: vi
          .fn()
          .mockRejectedValue(
            new WorkerFailure('temporary_failure', 'Temporary failure.', true)
          ),
        now: () => new Date('2026-06-11T12:00:00.000Z'),
      })
    ).resolves.toMatchObject({
      outcome: 'retry_scheduled',
      scanId: claim.scanId,
      failure: { code: 'temporary_failure' },
    })
    expect(repository.releaseScanForRetry).toHaveBeenCalledWith(
      claim.scanId,
      config.workerId,
      '2026-06-11T12:01:00.000Z',
      expect.objectContaining({ code: 'temporary_failure' })
    )
  })

  it('marks non-retryable failures terminally failed', async () => {
    const repository = createRepository()

    await expect(
      runWorkerOnce(config, {
        repository,
        processor: vi.fn().mockRejectedValue(
          new WorkerFailure('unsafe_archive', 'Repository archive is unsafe.', false)
        ),
      })
    ).resolves.toMatchObject({
      outcome: 'failed',
      failure: { code: 'unsafe_archive' },
    })
    expect(repository.failScan).toHaveBeenCalled()
    expect(repository.releaseScanForRetry).not.toHaveBeenCalled()
  })

  it('does not process a scan after losing its lease', async () => {
    const processor = vi.fn()
    const repository = createRepository({
      heartbeatScan: vi.fn().mockResolvedValue(false),
    })

    await expect(
      runWorkerOnce(config, { repository, processor })
    ).resolves.toMatchObject({
      outcome: 'lease_lost',
      failure: { code: 'lease_lost' },
    })
    expect(processor).not.toHaveBeenCalled()
    expect(repository.failScan).not.toHaveBeenCalled()
  })
})
