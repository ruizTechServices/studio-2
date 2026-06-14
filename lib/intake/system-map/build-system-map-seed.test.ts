import { describe, expect, it } from 'vitest'

import { buildSystemMapSeed } from '@/lib/intake/system-map/build-system-map-seed'
import type { SystemMapFileMetadata } from '@/lib/intake/system-map/contracts'

function file(relativePath: string, sizeBytes = 10): SystemMapFileMetadata {
  const name = relativePath.split('/').at(-1) ?? relativePath
  const extension = name.includes('.') ? name.split('.').at(-1) ?? null : null
  return {
    relativePath,
    name,
    extension,
    language: extension === 'ts' || extension === 'tsx' ? 'TypeScript' : null,
    category: 'source',
    sizeBytes,
    depth: relativePath.split('/').length,
    isText: true,
  }
}

describe('buildSystemMapSeed', () => {
  it('builds stable grouped output from shuffled metadata', () => {
    const files = [
      file('components/card.tsx'),
      file('app/page.tsx'),
      file('app/api/health/route.ts'),
      file('supabase/migrations/one.sql'),
      file('README.md'),
    ]
    const first = buildSystemMapSeed('scan', 'project', files)
    const second = buildSystemMapSeed('scan', 'project', [...files].reverse())

    expect(second).toEqual(first)
    expect(first.counts).toMatchObject({
      appRoutes: 1,
      apiEndpoints: 1,
      components: 1,
      database: 1,
      docs: 1,
    })
    expect(first.rootSummary).toMatchObject({
      totalFiles: 5,
      hasAppRouter: true,
      hasApiRoutes: true,
      hasComponents: true,
      hasDocs: true,
      hasDatabaseMigrations: true,
    })
    expect(first.generatedFrom).toBe('metadata_only')
  })

  it('detects bounded metadata-only framework and file summaries', () => {
    const files = [
      file('next.config.ts', 1),
      file('tsconfig.json', 2),
      file('tailwind.config.ts', 3),
      file('vitest.config.ts', 4),
      file('supabase/config.toml', 5),
      ...Array.from({ length: 7 }, (_, index) => file(`src/file-${index}.tsx`, 10 + index)),
    ]
    const seed = buildSystemMapSeed('scan', 'project', files)

    expect(seed.rootSummary.detectedFrameworkHints).toEqual([
      'Next.js',
      'React',
      'Supabase',
      'Tailwind CSS',
      'TypeScript',
      'Vitest',
    ])
    expect(seed.groups.sourceModules.preview).toHaveLength(5)
    expect(seed.rootSummary.largestFilesMetadataOnly).toHaveLength(5)
    expect(JSON.stringify(seed)).not.toContain('contentHash')
  })

  it('handles an empty inventory safely', () => {
    const seed = buildSystemMapSeed('scan', 'project', [])
    expect(seed.rootSummary.totalFiles).toBe(0)
    expect(seed.warnings).toHaveLength(1)
    expect(Object.values(seed.counts).every((count) => count === 0)).toBe(true)
  })
})
