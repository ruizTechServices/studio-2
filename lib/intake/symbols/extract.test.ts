import { describe, expect, it } from 'vitest'

import { extractSymbols, isSymbolCandidate } from '@/lib/intake/symbols/extract'

describe('extractSymbols', () => {
  it('extracts deterministic imports, exports, declarations, components, and hooks', () => {
    const symbols = extractSymbols(
      'src/example.tsx',
      `import React, { useState as state } from 'react'
export interface Props { value: string }
export const Widget = () => <div />
export function useThing() { return state(0) }
const value = 1`
    )

    expect(symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'import', name: 'React', importSource: 'react' }),
        expect.objectContaining({ kind: 'import', name: 'state', importSource: 'react' }),
        expect.objectContaining({ kind: 'type', name: 'Props', exported: true }),
        expect.objectContaining({ kind: 'component', name: 'Widget', exported: true }),
        expect.objectContaining({ kind: 'hook', name: 'useThing', exported: true }),
        expect.objectContaining({ kind: 'constant', name: 'value', exported: false }),
      ])
    )
    expect(symbols.every((symbol) => symbol.lineStart !== null)).toBe(true)
  })

  it('classifies exported route methods and skips unsupported files', () => {
    expect(extractSymbols('app/api/items/route.ts', 'export async function GET() {}')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'api_handler', name: 'GET', category: 'routing' }),
      ])
    )
    expect(isSymbolCandidate('src/file.py')).toBe(false)
    expect(extractSymbols('src/file.py', 'def value(): pass')).toEqual([])
    expect(extractSymbols('src/broken.ts', 'export function broken( {')).toEqual([])
  })
})
