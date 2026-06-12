import { describe, expect, it } from 'vitest'

import { parseArchivePolicy } from '@/lib/intake/archive/policy'
import { INTAKE_RESOURCE_LIMITS } from '@/lib/intake/policy'

describe('parseArchivePolicy', () => {
  it('accepts complete persisted limits at or below hard limits', () => {
    expect(parseArchivePolicy(INTAKE_RESOURCE_LIMITS)).toMatchObject({
      archiveEntriesMax: 20_000,
      directoryDepthMax: 35,
    })
  })

  it('rejects missing, non-integer, and above-hard-limit values', () => {
    expect(() => parseArchivePolicy({})).toThrowError(
      expect.objectContaining({ code: 'invalid_persisted_limits' })
    )
    expect(() =>
      parseArchivePolicy({
        ...INTAKE_RESOURCE_LIMITS,
        archiveEntriesMax: 20_001,
      })
    ).toThrowError(expect.objectContaining({ code: 'invalid_persisted_limits' }))
  })
})
