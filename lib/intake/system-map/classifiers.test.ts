import { describe, expect, it } from 'vitest'

import type { SystemMapFileMetadata } from '@/lib/intake/system-map/contracts'
import { classifySystemMapFile } from '@/lib/intake/system-map/classifiers'

function file(relativePath: string, extension = 'ts'): SystemMapFileMetadata {
  return {
    relativePath,
    name: relativePath.split('/').at(-1) ?? relativePath,
    extension,
    language: 'TypeScript',
    category: 'source',
    sizeBytes: 10,
    depth: relativePath.split('/').length,
    isText: true,
  }
}

describe('classifySystemMapFile', () => {
  it('classifies route handlers before app routes', () => {
    expect(classifySystemMapFile(file('app/api/health/route.ts'))).toBe('apiEndpoints')
    expect(classifySystemMapFile(file('app/page.tsx', 'tsx'))).toBe('appRoutes')
    expect(classifySystemMapFile(file('app/dashboard/layout.tsx', 'tsx'))).toBe('appRoutes')
  })

  it('classifies tests before components and source modules', () => {
    expect(classifySystemMapFile(file('components/card.test.tsx', 'tsx'))).toBe('tests')
    expect(classifySystemMapFile(file('src/__tests__/unit.ts'))).toBe('tests')
    expect(classifySystemMapFile(file('components/card.tsx', 'tsx'))).toBe('components')
  })

  it('classifies deterministic structural areas', () => {
    expect(classifySystemMapFile(file('pages/index.tsx', 'tsx'))).toBe('pages')
    expect(classifySystemMapFile(file('supabase/migrations/one.sql', 'sql'))).toBe('database')
    expect(classifySystemMapFile(file('next.config.ts'))).toBe('config')
    expect(classifySystemMapFile(file('docs/guide.md', 'md'))).toBe('docs')
    expect(classifySystemMapFile(file('public/logo.svg', 'svg'))).toBe('assets')
    expect(classifySystemMapFile(file('app/globals.css', 'css'))).toBe('styles')
    expect(classifySystemMapFile(file('scripts/run.ps1', 'ps1'))).toBe('scripts')
    expect(classifySystemMapFile(file('lib/helper.ts'))).toBe('sourceModules')
  })

  it('falls back conservatively to other', () => {
    expect(classifySystemMapFile(file('misc/unknown.bin', 'bin'))).toBe('other')
  })
})
