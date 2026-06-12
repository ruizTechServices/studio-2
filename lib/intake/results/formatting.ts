import type { CountItem } from '@/lib/intake/results/contracts'
import type { ScanStatus } from '@/lib/intake/contracts'

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'Unavailable'
  if (value < 1024) return `${value} B`

  const units = ['KiB', 'MiB', 'GiB'] as const
  let amount = value
  let unit = 'B'
  for (const candidate of units) {
    amount /= 1024
    unit = candidate
    if (amount < 1024) break
  }
  return `${amount >= 10 ? amount.toFixed(0) : amount.toFixed(1)} ${unit}`
}

export function formatCount(value: unknown): string {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value.toLocaleString('en-US')
    : '0'
}

export function getStatistic(
  statistics: Readonly<Record<string, unknown>>,
  key: string
): number {
  const value = statistics[key]
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0
}

export function formatCounts(value: unknown): readonly CountItem[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return []

  return Object.entries(value)
    .filter(
      (entry): entry is [string, number] =>
        entry[0].length > 0 &&
        typeof entry[1] === 'number' &&
        Number.isSafeInteger(entry[1]) &&
        entry[1] >= 0
    )
    .sort(([leftLabel, leftCount], [rightLabel, rightCount]) =>
      rightCount === leftCount
        ? leftLabel.localeCompare(rightLabel)
        : rightCount - leftCount
    )
    .map(([label, count]) => ({ label, count }))
}

export function shortCommitSha(value: string | null): string {
  return value ? value.slice(0, 8) : 'Unavailable'
}

export function getScanResultsPath(
  status: ScanStatus,
  projectId: string,
  scanId: string
): string | null {
  return status === 'completed' || status === 'completed_with_warnings'
    ? `/dashboard/projects/${projectId}/scans/${scanId}`
    : null
}
