import { describe, expect, it } from 'vitest'

import type { ScanFileInventory } from '@/lib/intake/archive/contracts'
import { buildReusableAssetCandidates } from '@/lib/intake/reusable-assets/classify'
import type { ScanSymbol, SymbolKind } from '@/lib/intake/symbols/contracts'

const file = (relativePath: string, category: ScanFileInventory['category'] = 'source'): ScanFileInventory => ({
  relativePath, name: relativePath.split('/').at(-1)!, extension: relativePath.split('.').at(-1)!,
  language: 'TypeScript', category, sizeBytes: 100, depth: 2, isText: true, contentHash: 'a'.repeat(64),
})
const symbol = (relativePath: string, name: string, kind: SymbolKind, exported = true): ScanSymbol => ({
  relativePath, name, kind, exported, importSource: null, lineStart: 1, lineEnd: 2,
  confidence: 'high', category: 'declaration',
})

describe('buildReusableAssetCandidates', () => {
  it('prioritizes exported components, hooks, utilities, APIs, types, and constants', () => {
    const paths = [
      'components/ui/card.tsx', 'hooks/use-item.ts', 'lib/utils/format.ts',
      'app/api/items/route.ts', 'lib/contracts/item.ts', 'config/limits.ts',
    ]
    const candidates = buildReusableAssetCandidates('scan', 'project', paths.map((path) => file(path)), [
      symbol(paths[0], 'Card', 'component'),
      symbol(paths[1], 'useItem', 'hook'),
      symbol(paths[2], 'formatItem', 'function'),
      symbol(paths[3], 'GET', 'api_handler'),
      symbol(paths[4], 'Item', 'type'),
      symbol(paths[5], 'LIMITS', 'constant'),
    ])
    expect(candidates.map((candidate) => candidate.assetKind)).toEqual(
      expect.arrayContaining(['ui_component', 'hook', 'utility', 'api_handler', 'type_definition', 'config_helper'])
    )
    expect(candidates.every((candidate) => candidate.confidence !== 'low')).toBe(true)
  })

  it('excludes imports, test globals, test files, and generated output', () => {
    const candidates = buildReusableAssetCandidates('scan', 'project', [
      file('src/value.test.ts', 'test'), file('node_modules/pkg/index.ts'), file('lib/value.ts'),
    ], [
      symbol('src/value.test.ts', 'describe', 'function'),
      symbol('node_modules/pkg/index.ts', 'tool', 'function'),
      symbol('lib/value.ts', 'expect', 'function'),
      symbol('lib/value.ts', 'dependency', 'import', false),
    ])
    expect(candidates).toEqual([])
  })

  it('sorts deterministically and bounds output', () => {
    const files = [file('lib/b.ts'), file('lib/a.ts')]
    const symbols = [
      symbol('lib/b.ts', 'beta', 'function'),
      symbol('lib/a.ts', 'alpha', 'function'),
    ]
    expect(buildReusableAssetCandidates('scan', 'project', files, symbols, 1)).toMatchObject([
      { relativePath: 'lib/a.ts', symbolName: 'alpha' },
    ])
  })
})
