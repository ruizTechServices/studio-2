import { describe, expect, it } from 'vitest'

import { LOG_LEVELS, LOG_SOURCES } from '@/lib/logger/types'

describe('logger constants', () => {
  it('exports the exact supported log levels in validation order', () => {
    expect(LOG_LEVELS).toEqual([
      'debug',
      'info',
      'warn',
      'error',
      'fatal',
      'audit',
    ])
  })

  it('exports the exact supported log sources', () => {
    expect(LOG_SOURCES).toEqual(['server', 'client'])
  })

  it('exports arrays suitable for membership validation', () => {
    expect(Array.isArray(LOG_LEVELS)).toBe(true)
    expect(Array.isArray(LOG_SOURCES)).toBe(true)
    expect(LOG_LEVELS.includes('warn')).toBe(true)
    expect(LOG_SOURCES.includes('client')).toBe(true)
  })
})
