import { describe, expect, it } from 'vitest'

import {
  formatBytes,
  formatCounts,
  getScanResultsPath,
  getStatistic,
  shortCommitSha,
} from '@/lib/intake/results/formatting'

describe('scan result formatting', () => {
  it('formats byte counts stably', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1024)).toBe('1.0 KiB')
    expect(formatBytes(10 * 1024)).toBe('10 KiB')
    expect(formatBytes(-1)).toBe('Unavailable')
  })

  it('sorts deterministic counts by count then label', () => {
    expect(formatCounts({ TypeScript: 3, JavaScript: 3, Go: 1 })).toEqual([
      { label: 'JavaScript', count: 3 },
      { label: 'TypeScript', count: 3 },
      { label: 'Go', count: 1 },
    ])
  })

  it('handles malformed statistics safely', () => {
    expect(formatCounts({ TypeScript: '3' })).toEqual([])
    expect(getStatistic({ filesDiscovered: -1 }, 'filesDiscovered')).toBe(0)
    expect(shortCommitSha(null)).toBe('Unavailable')
    expect(shortCommitSha('abcdef012345')).toBe('abcdef01')
  })

  it('builds results links only for completed scans', () => {
    expect(getScanResultsPath('completed', 'project', 'scan')).toBe(
      '/dashboard/projects/project/scans/scan'
    )
    expect(getScanResultsPath('completed_with_warnings', 'project', 'scan')).toBe(
      '/dashboard/projects/project/scans/scan'
    )
    expect(getScanResultsPath('failed', 'project', 'scan')).toBeNull()
    expect(getScanResultsPath('queued', 'project', 'scan')).toBeNull()
  })
})
