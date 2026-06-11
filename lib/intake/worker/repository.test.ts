import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'
const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import { scanWorkerRepository } from '@/lib/intake/worker/repository'

beforeEach(() => {
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('scanWorkerRepository', () => {
  it('claims and parses the next scan through the service-role RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          scan_id: SCAN_ID,
          project_id: PROJECT_ID,
          requested_ref: 'main',
          status: 'validating',
          attempt_count: 1,
          limits: { archiveEntriesMax: 20_000 },
          lease_expires_at: '2026-06-11T12:02:00.000Z',
        },
      ],
      error: null,
    })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).resolves.toEqual({
      scanId: SCAN_ID,
      projectId: PROJECT_ID,
      requestedRef: 'main',
      status: 'validating',
      attemptCount: 1,
      limits: { archiveEntriesMax: 20_000 },
      leaseExpiresAt: '2026-06-11T12:02:00.000Z',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('claim_next_scan', {
      p_worker_id: 'worker-1',
      p_lease_seconds: 120,
      p_max_attempts: 3,
    })
  })

  it('returns null when no scan is eligible', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).resolves.toBeNull()
  })

  it('rejects malformed claim responses safely', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ scan_id: SCAN_ID }], error: null })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).rejects.toMatchObject({ code: 'worker_invalid_response' })
  })

  it('classifies missing service-role configuration safely', async () => {
    mocks.createServiceRoleClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
    })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).rejects.toMatchObject({
      code: 'worker_repository_unavailable',
      message: 'Scan queue persistence is unavailable.',
    })
  })

  it('calls lifecycle RPCs with safe values', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })

    await expect(
      scanWorkerRepository.failScan(SCAN_ID, 'worker-1', {
        code: 'safe_failure',
        message: 'Safe failure.',
        retryable: false,
      })
    ).resolves.toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith('fail_scan', {
      p_scan_id: SCAN_ID,
      p_worker_id: 'worker-1',
      p_safe_error_code: 'safe_failure',
      p_safe_error_message: 'Safe failure.',
    })
  })
})
