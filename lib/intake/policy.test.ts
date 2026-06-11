import { describe, expect, it } from 'vitest'

import {
  INTAKE_RESOURCE_LIMITS,
  isProjectIntakeEnabled,
  isTerminalScanStatus,
} from '@/lib/intake/policy'

describe('INTAKE_RESOURCE_LIMITS', () => {
  it('captures the Phase 1 intake policy limits', () => {
    expect(INTAKE_RESOURCE_LIMITS).toEqual({
      compressedDownloadMaxBytes: 100 * 1024 * 1024,
      extractedContentMaxBytes: 250 * 1024 * 1024,
      archiveEntriesMax: 20_000,
      parsedTextFileMaxBytes: 2 * 1024 * 1024,
      pathMaxCharacters: 512,
      directoryDepthMax: 35,
      scanDurationMaxMinutes: 10,
      symbolsMax: 100_000,
      relationshipsMax: 200_000,
      concurrentScansPerWorker: 1,
    })
  })
})

describe('isProjectIntakeEnabled', () => {
  it('enables intake only when explicitly enabled outside production', () => {
    expect(
      isProjectIntakeEnabled({
        NODE_ENV: 'development',
        PROJECT_INTAKE_ENABLED: 'true',
      })
    ).toBe(true)
    expect(
      isProjectIntakeEnabled({
        NODE_ENV: 'development',
        PROJECT_INTAKE_ENABLED: 'false',
      })
    ).toBe(false)
    expect(
      isProjectIntakeEnabled({
        NODE_ENV: 'production',
        PROJECT_INTAKE_ENABLED: 'true',
      })
    ).toBe(false)
  })
})

describe('isTerminalScanStatus', () => {
  it('recognizes only completed and failed states as terminal', () => {
    expect(isTerminalScanStatus('completed')).toBe(true)
    expect(isTerminalScanStatus('completed_with_warnings')).toBe(true)
    expect(isTerminalScanStatus('failed')).toBe(true)
    expect(isTerminalScanStatus('queued')).toBe(false)
  })
})
