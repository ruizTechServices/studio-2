import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ReusableAssetCandidatesView } from '@/components/intake/scan-results/reusable-asset-candidates-view'

describe('ReusableAssetCandidatesView', () => {
  it('renders candidate metadata without source', () => {
    const html = renderToStaticMarkup(<ReusableAssetCandidatesView summary={{
      total: 1,
      preview: [{
        scanId: 'scan', projectId: 'project', relativePath: 'lib/utils/format.ts',
        symbolName: 'formatItem', symbolKind: 'function', assetKind: 'utility',
        exported: true, confidence: 'high', reuseScore: 80,
        reasons: ['Exported declaration', 'Utility-oriented path'],
      }],
    }} />)
    expect(html).toContain('Reusable Asset Candidates')
    expect(html).toContain('formatItem')
    expect(html).toContain('Utility-oriented path')
    expect(html).not.toContain('return secret')
  })

  it('renders an empty state', () => {
    const html = renderToStaticMarkup(
      <ReusableAssetCandidatesView summary={{ total: 0, preview: [] }} />
    )
    expect(html).toContain('No reusable asset candidates available')
  })
})
