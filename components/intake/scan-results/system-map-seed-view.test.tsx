import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SystemMapSeedView } from '@/components/intake/scan-results/system-map-seed-view'
import { buildSystemMapSeed } from '@/lib/intake/system-map/build-system-map-seed'

describe('SystemMapSeedView', () => {
  it('renders a metadata-only compact overview', () => {
    const seed = buildSystemMapSeed('scan', 'project', [
      {
        relativePath: 'app/page.tsx',
        name: 'page.tsx',
        extension: 'tsx',
        language: 'TypeScript',
        category: 'source',
        sizeBytes: 100,
        depth: 2,
        isText: true,
      },
    ])
    const html = renderToStaticMarkup(<SystemMapSeedView seed={seed} />)
    expect(html).toContain('Deterministic system overview')
    expect(html).toContain('App routes')
    expect(html).toContain('app/page.tsx')
    expect(html).not.toContain('contentHash')
  })

  it('renders the empty metadata state', () => {
    const seed = buildSystemMapSeed('scan', 'project', [])
    expect(renderToStaticMarkup(<SystemMapSeedView seed={seed} />)).toContain(
      'No structure metadata available'
    )
  })
})
