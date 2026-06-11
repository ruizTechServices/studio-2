import { describe, expect, it } from 'vitest'

import { getWorkerConfig } from '@/lib/intake/worker/config'

describe('getWorkerConfig', () => {
  it('uses safe defaults and generates a worker ID', () => {
    const config = getWorkerConfig({})

    expect(config).toMatchObject({
      leaseSeconds: 120,
      maxAttempts: 3,
      pollMs: 5_000,
      retryDelaySeconds: 60,
    })
    expect(config.workerId).toMatch(/^scan-worker-[0-9a-f-]+$/)
  })

  it('accepts valid environment overrides', () => {
    expect(
      getWorkerConfig({
        SCAN_WORKER_ID: 'local-worker:1',
        SCAN_WORKER_LEASE_SECONDS: '240',
        SCAN_WORKER_MAX_ATTEMPTS: '5',
        SCAN_WORKER_POLL_MS: '1000',
        SCAN_WORKER_RETRY_DELAY_SECONDS: '90',
      })
    ).toEqual({
      workerId: 'local-worker:1',
      leaseSeconds: 240,
      maxAttempts: 5,
      pollMs: 1_000,
      retryDelaySeconds: 90,
    })
  })

  it('falls back for invalid or out-of-range values', () => {
    const config = getWorkerConfig({
      SCAN_WORKER_ID: 'invalid worker id',
      SCAN_WORKER_LEASE_SECONDS: '1',
      SCAN_WORKER_MAX_ATTEMPTS: '0',
      SCAN_WORKER_POLL_MS: '-1',
      SCAN_WORKER_RETRY_DELAY_SECONDS: 'not-a-number',
    })

    expect(config.workerId).toMatch(/^scan-worker-[0-9a-f-]+$/)
    expect(config).toMatchObject({
      leaseSeconds: 120,
      maxAttempts: 3,
      pollMs: 5_000,
      retryDelaySeconds: 60,
    })
  })
})
