import type { TerminalScanStatus } from '@/lib/intake/contracts'

export interface WorkerConfig {
  readonly workerId: string
  readonly leaseSeconds: number
  readonly maxAttempts: number
  readonly pollMs: number
  readonly retryDelaySeconds: number
}

export interface ScanClaim {
  readonly scanId: string
  readonly projectId: string
  readonly requestedRef: string | null
  readonly status: 'validating'
  readonly attemptCount: number
  readonly limits: Record<string, unknown>
  readonly leaseExpiresAt: string
}

export interface ScanCompletion {
  readonly status: Extract<
    TerminalScanStatus,
    'completed' | 'completed_with_warnings'
  >
  readonly statistics: Record<string, unknown>
  readonly warnings: readonly string[]
}

export type ScanProcessor = (claim: ScanClaim) => Promise<ScanCompletion>

export interface ScanWorkerRepository {
  claimNextScan(config: WorkerConfig): Promise<ScanClaim | null>
  heartbeatScan(
    scanId: string,
    workerId: string,
    leaseSeconds: number
  ): Promise<boolean>
  releaseScanForRetry(
    scanId: string,
    workerId: string,
    nextAttemptAt: string,
    failure: SafeWorkerFailure
  ): Promise<boolean>
  failScan(
    scanId: string,
    workerId: string,
    failure: SafeWorkerFailure
  ): Promise<boolean>
  completeScan(
    scanId: string,
    workerId: string,
    completion: ScanCompletion
  ): Promise<boolean>
}

export interface SafeWorkerFailure {
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export type WorkerRunResult =
  | { readonly outcome: 'idle' }
  | { readonly outcome: 'completed'; readonly scanId: string }
  | {
      readonly outcome: 'retry_scheduled' | 'failed' | 'lease_lost'
      readonly scanId: string
      readonly failure: SafeWorkerFailure
    }
