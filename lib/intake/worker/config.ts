import { randomUUID } from 'node:crypto'

import type { WorkerConfig } from '@/lib/intake/worker/contracts'

const WORKER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    return fallback
  }

  const parsed = Number(value)

  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback
}

function getWorkerId(value: string | undefined): string {
  const candidate = value?.trim()

  return candidate && WORKER_ID_PATTERN.test(candidate)
    ? candidate
    : `scan-worker-${randomUUID()}`
}

export function getWorkerConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): WorkerConfig {
  return {
    workerId: getWorkerId(environment.SCAN_WORKER_ID),
    leaseSeconds: parseInteger(
      environment.SCAN_WORKER_LEASE_SECONDS,
      120,
      15,
      3_600
    ),
    maxAttempts: parseInteger(
      environment.SCAN_WORKER_MAX_ATTEMPTS,
      3,
      1,
      20
    ),
    pollMs: parseInteger(environment.SCAN_WORKER_POLL_MS, 5_000, 100, 300_000),
    retryDelaySeconds: parseInteger(
      environment.SCAN_WORKER_RETRY_DELAY_SECONDS,
      60,
      1,
      86_400
    ),
  }
}
