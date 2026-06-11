export const SCAN_STATUSES = [
  'queued',
  'fetching',
  'validating',
  'extracting',
  'parsing',
  'persisting',
  'completed',
  'completed_with_warnings',
  'failed',
] as const

export const TERMINAL_SCAN_STATUSES = [
  'completed',
  'completed_with_warnings',
  'failed',
] as const

export const SUMMARY_STATUSES = [
  'not_started',
  'pending',
  'completed',
  'failed',
] as const

export type ScanStatus = (typeof SCAN_STATUSES)[number]
export type TerminalScanStatus = (typeof TERMINAL_SCAN_STATUSES)[number]
export type SummaryStatus = (typeof SUMMARY_STATUSES)[number]
export type IntakeField = 'repositoryUrl' | 'ref'

export interface ProjectImportRequest {
  readonly repositoryUrl: string
  readonly ref?: string
}

export interface ProjectImportResponse {
  readonly projectId: string
  readonly scanId: string
  readonly status: 'queued'
}

export interface ScanStatusResponse {
  readonly scanId: string
  readonly projectId: string
  readonly status: ScanStatus
  readonly statistics: Record<string, unknown>
  readonly warnings: readonly string[]
  readonly safeError: string | null
  readonly summaryStatus: SummaryStatus
}

export interface IntakeApiError {
  readonly error: string
  readonly field?: IntakeField
}
