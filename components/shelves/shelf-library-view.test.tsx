import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ShelfLibraryView } from '@/components/shelves/shelf-library-view'
import type { ShelfAsset } from '@/lib/shelves/contracts'

const asset: ShelfAsset = {
  id: '123e4567-e89b-42d3-a456-426614174010',
  shelf: 'components',
  assetKind: 'ui_component',
  symbolName: 'DarkModeToggle',
  symbolKind: 'component',
  exported: true,
  sourceOwner: 'owner',
  sourceRepository: 'repository',
  sourceCanonicalUrl: 'https://github.com/owner/repository',
  sourceCommitSha: 'a'.repeat(40),
  relativePath: 'components/ui/dark-mode-toggle.tsx',
  lineStart: 4,
  lineEnd: 62,
  projectId: '123e4567-e89b-42d3-a456-426614174000',
  reuseScore: 92,
  confidence: 'high',
  reasons: ['Exported declaration'],
  tags: ['tailwind', 'dark-mode'],
  notes: 'Solid toggle.',
  visibility: 'private',
  version: 2,
  timesPromoted: 3,
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
}

describe('ShelfLibraryView', () => {
  it('renders asset cards with provenance and tags', () => {
    const html = renderToStaticMarkup(
      <ShelfLibraryView
        query={{ query: 'dark mode', shelf: null, limit: 24 }}
        result={{ total: 1, shelfCounts: { components: 1 }, assets: [asset] }}
      />
    )
    expect(html).toContain('DarkModeToggle')
    expect(html).toContain('components/ui/dark-mode-toggle.tsx')
    expect(html).toContain('owner/repository')
    expect(html).toContain('aaaaaaa')
    expect(html).toContain('v2')
    expect(html).toContain('dark-mode')
    expect(html).toContain('92 · high')
  })

  it('renders the empty state when nothing is shelved', () => {
    const html = renderToStaticMarkup(
      <ShelfLibraryView
        query={{ query: null, shelf: null, limit: 24 }}
        result={{ total: 0, shelfCounts: {}, assets: [] }}
      />
    )
    expect(html).toContain('Your library is empty')
  })

  it('renders a search-specific empty state for filtered views', () => {
    const html = renderToStaticMarkup(
      <ShelfLibraryView
        query={{ query: 'nonexistent', shelf: 'hooks', limit: 24 }}
        result={{ total: 0, shelfCounts: {}, assets: [] }}
      />
    )
    expect(html).toContain('Nothing on the shelf matches this search')
  })
})
