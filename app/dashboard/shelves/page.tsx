import { notFound } from 'next/navigation'

import { ShelfLibraryView } from '@/components/shelves/shelf-library-view'
import { isProjectIntakeEnabled } from '@/lib/intake/policy'
import { logWarn } from '@/lib/logger/server'
import type { ShelfSearchResult } from '@/lib/shelves/contracts'
import {
  searchShelfAssets,
  ShelfPersistenceError,
} from '@/lib/shelves/repository'
import { validateShelfSearchQuery } from '@/lib/shelves/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ShelvesPageProps {
  readonly searchParams: Promise<{
    q?: string
    shelf?: string
    limit?: string
  }>
}

export default async function ShelvesPage({ searchParams }: ShelvesPageProps) {
  if (!isProjectIntakeEnabled()) notFound()

  const parameters = await searchParams
  const validation = validateShelfSearchQuery({
    query: parameters.q ?? null,
    shelf: parameters.shelf ?? null,
    limit: parameters.limit ?? null,
  })
  const query = validation.ok
    ? validation.value
    : { query: null, shelf: null, limit: 24 as const }

  let result: ShelfSearchResult
  try {
    result = await searchShelfAssets(query)
  } catch (error) {
    await logWarn({
      message: 'Shelf library lookup failed',
      route: '/dashboard/shelves',
      context: {
        code: error instanceof ShelfPersistenceError ? error.code : 'unexpected',
      },
    })
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl border bg-card p-10 text-center">
          <p className="text-sm font-medium">The shelf library is unavailable</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try again once the database connection is restored.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shelves</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Your durable reusable asset library. Every entry is a provenance
          pointer to an exact commit — promoted from scan candidates, versioned
          across re-scans, and searchable by name, path, kind, and tags.
        </p>
      </div>

      <ShelfLibraryView query={query} result={result} />
    </div>
  )
}
