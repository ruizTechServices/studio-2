import type { TerminalScanStatus } from '@/lib/intake/contracts'
import type { ScanFileInventory } from '@/lib/intake/archive/contracts'
import type { ScanSymbol } from '@/lib/intake/symbols/contracts'
import type { ReusableAssetCandidate } from '@/lib/intake/reusable-assets/contracts'

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
  readonly owner: string
  readonly repository: string
  readonly defaultBranch: string | null
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
  readonly projectId: string
  readonly defaultBranch: string
  readonly resolvedRef: string
  readonly sourceCommitSha: string
  readonly expectedFileCount: number
  readonly expectedSymbolCount: number
  readonly expectedReusableAssetCandidateCount: number
}

export interface ScanProcessorContext {
  readonly repository: ScanWorkerRepository
  readonly workerId: string
  readonly signal: AbortSignal
}

export type ScanProcessor = (
  claim: ScanClaim,
  context: ScanProcessorContext
) => Promise<ScanCompletion>

export interface ScanWorkerRepository {
  claimNextScan(config: WorkerConfig): Promise<ScanClaim | null>
  heartbeatScan(
    scanId: string,
    workerId: string,
    leaseSeconds: number
  ): Promise<boolean>
  transitionScanStage(
    scanId: string,
    workerId: string,
    status: 'validating' | 'fetching' | 'extracting' | 'persisting'
  ): Promise<boolean>
  beginScanInventory(scanId: string, workerId: string): Promise<boolean>
  persistScanFilesBatch(
    scanId: string,
    workerId: string,
    files: readonly ScanFileInventory[]
  ): Promise<boolean>
  persistScanSymbolsBatch(
    scanId: string,
    workerId: string,
    symbols: readonly ScanSymbol[]
  ): Promise<boolean>
  persistReusableAssetCandidatesBatch(
    scanId: string,
    workerId: string,
    candidates: readonly ReusableAssetCandidate[]
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
