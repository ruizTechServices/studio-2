import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { SymbolSummaryView } from '@/components/intake/scan-results/symbol-summary-view'

describe('SymbolSummaryView', () => {
  it('renders compact counts and bounded symbol metadata', () => {
    const counts = {
      import: 0, export: 0, function: 0, component: 0, hook: 1,
      api_handler: 0, type: 0, constant: 0, unknown: 0,
    }
    const html = renderToStaticMarkup(
      <SymbolSummaryView summary={{
        total: 1,
        counts,
        preview: [{
          relativePath: 'src/use-item.ts',
          kind: 'hook',
          name: 'useItem',
          exported: true,
          importSource: null,
          lineStart: 3,
          lineEnd: 5,
          confidence: 'high',
          category: 'declaration',
        }],
      }} />
    )
    expect(html).toContain('Symbol Summary')
    expect(html).toContain('hook:')
    expect(html).toContain('src/use-item.ts:3')
    expect(html).not.toContain('return secret')
  })
})
