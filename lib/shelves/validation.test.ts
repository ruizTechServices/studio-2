import { describe, expect, it } from 'vitest'

import {
  validatePromoteShelfAssetRequest,
  validateShelfSearchQuery,
} from '@/lib/shelves/validation'

const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'
const PROJECT_ID = '123E4567-E89B-42D3-A456-426614174000'

const validPromotePayload = {
  scanId: SCAN_ID,
  projectId: PROJECT_ID,
  relativePath: 'components/ui/button.tsx',
  symbolName: 'Button',
  symbolKind: 'component',
}

describe('validatePromoteShelfAssetRequest', () => {
  it('accepts a minimal payload and normalizes ids', () => {
    const result = validatePromoteShelfAssetRequest(validPromotePayload)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).toEqual({
      scanId: SCAN_ID,
      projectId: PROJECT_ID.toLowerCase(),
      relativePath: 'components/ui/button.tsx',
      symbolName: 'Button',
      symbolKind: 'component',
      shelf: null,
      tags: [],
      notes: null,
    })
  })

  it('accepts explicit shelf, tags, and notes', () => {
    const result = validatePromoteShelfAssetRequest({
      ...validPromotePayload,
      shelf: 'components',
      tags: ['tailwind', 'dark-mode', 'tailwind'],
      notes: '  Solid toggle. ',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.shelf).toBe('components')
    expect(result.value.tags).toEqual(['tailwind', 'dark-mode'])
    expect(result.value.notes).toBe('Solid toggle.')
  })

  it.each([
    [null],
    ['string'],
    [[]],
  ])('rejects non-object payloads (%s)', (payload) => {
    expect(validatePromoteShelfAssetRequest(payload).ok).toBe(false)
  })

  it('rejects malformed identifiers', () => {
    const badScan = validatePromoteShelfAssetRequest({
      ...validPromotePayload,
      scanId: 'not-a-uuid',
    })
    expect(badScan).toMatchObject({ ok: false, field: 'scanId' })

    const badProject = validatePromoteShelfAssetRequest({
      ...validPromotePayload,
      projectId: 42,
    })
    expect(badProject).toMatchObject({ ok: false, field: 'projectId' })
  })

  it('rejects out-of-bounds path and symbol values', () => {
    expect(
      validatePromoteShelfAssetRequest({
        ...validPromotePayload,
        relativePath: 'x'.repeat(513),
      })
    ).toMatchObject({ ok: false, field: 'relativePath' })
    expect(
      validatePromoteShelfAssetRequest({
        ...validPromotePayload,
        symbolName: '',
      })
    ).toMatchObject({ ok: false, field: 'symbolName' })
    expect(
      validatePromoteShelfAssetRequest({
        ...validPromotePayload,
        symbolKind: 'import',
      })
    ).toMatchObject({ ok: false, field: 'symbolKind' })
  })

  it('rejects unknown shelves and malformed tags', () => {
    expect(
      validatePromoteShelfAssetRequest({
        ...validPromotePayload,
        shelf: 'weapons',
      })
    ).toMatchObject({ ok: false, field: 'shelf' })
    expect(
      validatePromoteShelfAssetRequest({
        ...validPromotePayload,
        tags: ['UPPERCASE'],
      })
    ).toMatchObject({ ok: false, field: 'tags' })
    expect(
      validatePromoteShelfAssetRequest({
        ...validPromotePayload,
        tags: Array.from({ length: 9 }, (_, index) => `tag-${index}`),
      })
    ).toMatchObject({ ok: false, field: 'tags' })
  })

  it('rejects oversized notes', () => {
    expect(
      validatePromoteShelfAssetRequest({
        ...validPromotePayload,
        notes: 'n'.repeat(501),
      })
    ).toMatchObject({ ok: false, field: 'notes' })
  })
})

describe('validateShelfSearchQuery', () => {
  it('defaults to an unfiltered recent listing', () => {
    const result = validateShelfSearchQuery({})
    expect(result).toEqual({
      ok: true,
      value: { query: null, shelf: null, limit: 24 },
    })
  })

  it('trims queries and treats blank input as no query', () => {
    const result = validateShelfSearchQuery({ query: '  dark mode toggle  ' })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.query).toBe('dark mode toggle')

    const blank = validateShelfSearchQuery({ query: '   ' })
    expect(blank.ok).toBe(true)
    if (!blank.ok) return
    expect(blank.value.query).toBeNull()
  })

  it('accepts a known shelf and bounded limit', () => {
    const result = validateShelfSearchQuery({ shelf: 'hooks', limit: '50' })
    expect(result).toEqual({
      ok: true,
      value: { query: null, shelf: 'hooks', limit: 50 },
    })
  })

  it('rejects oversized queries, unknown shelves, and bad limits', () => {
    expect(
      validateShelfSearchQuery({ query: 'q'.repeat(161) })
    ).toMatchObject({ ok: false, field: 'query' })
    expect(validateShelfSearchQuery({ shelf: 'weapons' })).toMatchObject({
      ok: false,
      field: 'shelf',
    })
    expect(validateShelfSearchQuery({ limit: '0' })).toMatchObject({
      ok: false,
      field: 'limit',
    })
    expect(validateShelfSearchQuery({ limit: '51' })).toMatchObject({
      ok: false,
      field: 'limit',
    })
    expect(validateShelfSearchQuery({ limit: '2.5' })).toMatchObject({
      ok: false,
      field: 'limit',
    })
  })
})
