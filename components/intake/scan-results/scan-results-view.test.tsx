import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ScanResultsView } from '@/components/intake/scan-results/scan-results-view'
import type { ScanResults } from '@/lib/intake/results/contracts'
import { buildSystemMapSeed } from '@/lib/intake/system-map/build-system-map-seed'

function results(overrides: Partial<ScanResults['scan']> = {}): ScanResults {
  return {
    project: {
      id: 'project-id',
      owner: 'owner',
      repository: 'repository',
      canonicalUrl: 'https://github.com/owner/repository',
      defaultBranch: 'main',
    },
    scan: {
      id: 'scan-id',
      projectId: 'project-id',
      requestedRef: null,
      resolvedRef: 'main',
      sourceCommitSha: 'abcdef0123456789',
      status: 'completed',
      statistics: {
        filesDiscovered: 1,
        textFiles: 1,
        binaryFiles: 0,
        totalExtractedBytes: 1024,
        oversizedTextFiles: 0,
        languageCounts: { TypeScript: 1 },
        categoryCounts: { source: 1 },
      },
      warnings: [],
      safeError: null,
      createdAt: '2026-06-12T12:00:00.000Z',
      startedAt: '2026-06-12T12:01:00.000Z',
      completedAt: '2026-06-12T12:02:00.000Z',
      updatedAt: '2026-06-12T12:02:00.000Z',
      ...overrides,
    },
    inventoryPreview: [
      {
        relativePath: 'src/index.ts',
        language: 'TypeScript',
        category: 'source',
        sizeBytes: 1024,
        isText: true,
      },
    ],
    systemMapSeed: buildSystemMapSeed('scan-id', 'project-id', [
      {
        relativePath: 'src/index.ts',
        name: 'index.ts',
        extension: 'ts',
        language: 'TypeScript',
        category: 'source',
        sizeBytes: 1024,
        depth: 2,
        isText: true,
      },
    ]),
  }
}

describe('ScanResultsView', () => {
  it('renders completed scan summary counts and metadata-only preview', () => {
    const html = renderToStaticMarkup(<ScanResultsView results={results()} />)
    expect(html).toContain('owner/repository')
    expect(html).toContain('Files discovered')
    expect(html).toContain('src/index.ts')
    expect(html).toContain('TypeScript')
    expect(html).not.toContain('contentHash')
    expect(html).not.toContain('console.log("secret source")')
  })

  it('renders safe warning and failed states', () => {
    const warningHtml = renderToStaticMarkup(
      <ScanResultsView
        results={results({
          status: 'completed_with_warnings',
          warnings: ['Some text files were inventoried only.'],
        })}
      />
    )
    expect(warningHtml).toContain('Warnings: 1')
    expect(warningHtml).toContain('Some text files were inventoried only.')

    const failureHtml = renderToStaticMarkup(
      <ScanResultsView
        results={results({
          status: 'failed',
          safeError: 'Repository archive is unsafe.',
        })}
      />
    )
    expect(failureHtml).toContain('Scan failed safely')
    expect(failureHtml).toContain('Repository archive is unsafe.')
  })

  it('renders an empty inventory state', () => {
    const value = { ...results(), inventoryPreview: [] }
    expect(renderToStaticMarkup(<ScanResultsView results={value} />)).toContain(
      'No file inventory available'
    )
  })
})
