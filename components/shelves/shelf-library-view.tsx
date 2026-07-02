import { Library, Search } from 'lucide-react'
import Link from 'next/link'

import { SourcePreviewPanel } from '@/components/shelves/source-preview-panel'
import type {
  ShelfName,
  ShelfSearchQuery,
  ShelfSearchResult,
} from '@/lib/shelves/contracts'
import { SHELF_NAMES } from '@/lib/shelves/contracts'
import { cn } from '@/lib/utils'

function shelfHref(query: ShelfSearchQuery, shelf: ShelfName | null): string {
  const parameters = new URLSearchParams()
  if (query.query) parameters.set('q', query.query)
  if (shelf) parameters.set('shelf', shelf)
  const encoded = parameters.toString()
  return encoded ? `/dashboard/shelves?${encoded}` : '/dashboard/shelves'
}

/**
 * Presentational shelf library: plain GET search form (no client JS), facet
 * chips per shelf, and provenance-first asset cards.
 */
export function ShelfLibraryView({
  query,
  result,
}: Readonly<{ query: ShelfSearchQuery; result: ShelfSearchResult }>) {
  return (
    <section className="space-y-4">
      <form
        method="get"
        action="/dashboard/shelves"
        className="flex items-center gap-2"
      >
        <label htmlFor="shelf-search" className="sr-only">
          Search shelved assets
        </label>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            id="shelf-search"
            name="q"
            type="search"
            defaultValue={query.query ?? ''}
            maxLength={160}
            placeholder="Search your library — e.g. dark mode toggle, auth hook, rate limiter"
            className="w-full rounded-lg border bg-card py-2 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {query.shelf ? (
          <input type="hidden" name="shelf" value={query.shelf} />
        ) : null}
        <button
          type="submit"
          className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Search
        </button>
      </form>

      <nav aria-label="Shelves" className="flex flex-wrap gap-2">
        <Link
          href={shelfHref(query, null)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs',
            query.shelf === null
              ? 'border-foreground bg-foreground text-background'
              : 'bg-card text-muted-foreground hover:bg-muted'
          )}
        >
          All · {result.total.toLocaleString()}
        </Link>
        {SHELF_NAMES.map((shelf) => {
          const count = result.shelfCounts[shelf] ?? 0
          if (count === 0 && query.shelf !== shelf) return null
          return (
            <Link
              key={shelf}
              href={shelfHref(query, shelf)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs',
                query.shelf === shelf
                  ? 'border-foreground bg-foreground text-background'
                  : 'bg-card text-muted-foreground hover:bg-muted'
              )}
            >
              {shelf} · {count.toLocaleString()}
            </Link>
          )
        })}
      </nav>

      {result.assets.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Library
            className="mx-auto size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium">
            {query.query || query.shelf
              ? 'Nothing on the shelf matches this search'
              : 'Your library is empty'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scan a repository, then promote candidates from the scan results to
            start building your library.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {result.assets.map((asset) => (
            <article
              key={asset.id}
              className="flex flex-col rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-mono text-sm font-semibold">
                    {asset.symbolName}
                  </h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {asset.assetKind.replaceAll('_', ' ')} · v{asset.version}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border bg-muted/40 px-2 py-1 font-mono text-[10px]">
                  {asset.reuseScore} · {asset.confidence}
                </span>
              </div>

              <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground">
                {asset.relativePath}
                {asset.lineStart !== null && asset.lineEnd !== null
                  ? `:${asset.lineStart}–${asset.lineEnd}`
                  : ''}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {asset.sourceOwner}/{asset.sourceRepository} @{' '}
                <span className="font-mono">
                  {asset.sourceCommitSha.slice(0, 7)}
                </span>
              </p>

              {asset.notes ? (
                <p className="mt-2 line-clamp-2 text-xs leading-5">
                  {asset.notes}
                </p>
              ) : null}

              {asset.tags.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-1">
                  {asset.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded bg-muted/40 px-2 py-1 text-[10px] text-muted-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}

              <SourcePreviewPanel assetId={asset.id} />
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
