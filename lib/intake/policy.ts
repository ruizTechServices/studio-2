import {
  SCAN_STATUSES,
  SUMMARY_STATUSES,
  TERMINAL_SCAN_STATUSES,
  type ScanStatus,
  type SummaryStatus,
} from '@/lib/intake/contracts'

const MEBIBYTE = 1024 * 1024

export const INTAKE_RESOURCE_LIMITS = {
  compressedDownloadMaxBytes: 100 * MEBIBYTE,
  extractedContentMaxBytes: 250 * MEBIBYTE,
  archiveEntriesMax: 20_000,
  parsedTextFileMaxBytes: 2 * MEBIBYTE,
  pathMaxCharacters: 512,
  directoryDepthMax: 35,
  scanDurationMaxMinutes: 10,
  symbolsMax: 100_000,
  relationshipsMax: 200_000,
  concurrentScansPerWorker: 1,
} as const

export function isProjectIntakeEnabled(
  environment: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    environment.NODE_ENV !== 'production' &&
    environment.PROJECT_INTAKE_ENABLED === 'true'
  )
}

export function isScanStatus(value: unknown): value is ScanStatus {
  return (
    typeof value === 'string' &&
    (SCAN_STATUSES as readonly string[]).includes(value)
  )
}

export function isTerminalScanStatus(value: ScanStatus): boolean {
  return (TERMINAL_SCAN_STATUSES as readonly string[]).includes(value)
}

export function isSummaryStatus(value: unknown): value is SummaryStatus {
  return (
    typeof value === 'string' &&
    (SUMMARY_STATUSES as readonly string[]).includes(value)
  )
}
