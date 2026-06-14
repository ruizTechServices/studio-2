import { describe, expect, it } from 'vitest'

import { formatSystemMapGroupLabel } from '@/lib/intake/system-map/formatting'

describe('formatSystemMapGroupLabel', () => {
  it('formats stable user-facing group labels', () => {
    expect(formatSystemMapGroupLabel('apiEndpoints')).toBe('API endpoints')
    expect(formatSystemMapGroupLabel('sourceModules')).toBe('Source modules')
    expect(formatSystemMapGroupLabel('other')).toBe('Other')
  })
})
