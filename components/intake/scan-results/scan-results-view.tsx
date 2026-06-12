import {
  AlertCircle,
  Binary,
  FileSearch,
  FileText,
  GitBranch,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'

import { SystemMapSeedView } from '@/components/intake/scan-results/system-map-seed-view'
import type { ScanResults } from '@/lib/intake/results/contracts'
import {
  formatBytes,
  formatCount,
  formatCounts,
  getStatistic,
  shortCommitSha,
} from '@/lib/intake/results/formatting'

function StatusBadge({ status }: Readonly<{ status: string }>) {
  return (
    <span className="rounded-full border bg-muted/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
      {status}
    </span>
  )
}

function CountPanel({
  title,
  counts,
}: Readonly<{ title: string; counts: readonly { label: string; count: number }[] }>) {
  return (
    <section className="rounded-xl border bg-card p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {counts.length > 0 ? (
        <div className="mt-4 space-y-2">
          {counts.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-4 rounded-lg bg-muted/30 px-3 py-2"
            >
              <span className="text-xs font-medium capitalize">{item.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatCount(item.count)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          No deterministic counts are available yet.
        </p>
      )}
    </section>
  )
}

function InventoryPreview({ results }: Readonly<{ results: ScanResults }>) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-5">
        <h2 className="text-sm font-semibold">File inventory preview</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Metadata-only preview, limited to 50 repository-relative paths.
        </p>
      </div>
      {results.inventoryPreview.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <FileSearch className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No file inventory available</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This scan has no persisted file metadata.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-muted/30 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Relative path</th>
                <th className="px-4 py-3 font-medium">Language</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Kind</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {results.inventoryPreview.map((file) => (
                <tr key={file.relativePath}>
                  <td className="max-w-md truncate px-4 py-3 font-mono">
                    {file.relativePath}
                  </td>
                  <td className="px-4 py-3">{file.language ?? 'Unknown'}</td>
                  <td className="px-4 py-3 capitalize">{file.category}</td>
                  <td className="px-4 py-3">{formatBytes(file.sizeBytes)}</td>
                  <td className="px-4 py-3">{file.isText ? 'Text' : 'Binary'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function ScanMessages({ results }: Readonly<{ results: ScanResults }>) {
  if (results.scan.status === 'failed') {
    return (
      <section className="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-semibold text-destructive">Scan failed safely</h2>
            <p className="mt-2 text-xs leading-5 text-destructive">
              {results.scan.safeError ?? 'The scan could not be completed safely.'}
            </p>
          </div>
        </div>
      </section>
    )
  }

  if (results.scan.warnings.length === 0) return null
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">
            Warnings: {results.scan.warnings.length}
          </h2>
          <ul className="mt-2 space-y-1 text-xs leading-5">
            {results.scan.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function ScanResultsView({ results }: Readonly<{ results: ScanResults }>) {
  const statistics = results.scan.statistics
  const cards = [
    {
      label: 'Files discovered',
      value: formatCount(getStatistic(statistics, 'filesDiscovered')),
      icon: FileSearch,
    },
    {
      label: 'Text files',
      value: formatCount(getStatistic(statistics, 'textFiles')),
      icon: FileText,
    },
    {
      label: 'Binary files',
      value: formatCount(getStatistic(statistics, 'binaryFiles')),
      icon: Binary,
    },
    {
      label: 'Extracted metadata size',
      value: formatBytes(getStatistic(statistics, 'totalExtractedBytes')),
      icon: GitBranch,
    },
    {
      label: 'Oversized text files',
      value: formatCount(getStatistic(statistics, 'oversizedTextFiles')),
      icon: AlertCircle,
    },
  ] as const

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/dashboard/import" className="text-xs text-blue-700 hover:underline">
              Back to repository intake
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {results.project.owner}/{results.project.repository}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deterministic scan metadata and bounded file inventory.
            </p>
          </div>
          <StatusBadge status={results.scan.status} />
        </div>
        <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          <div className="rounded-lg bg-muted/30 p-3">
            <dt className="text-muted-foreground">Requested ref</dt>
            <dd className="mt-1 font-mono">{results.scan.requestedRef ?? 'Default branch'}</dd>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <dt className="text-muted-foreground">Resolved ref</dt>
            <dd className="mt-1 font-mono">{results.scan.resolvedRef ?? 'Unavailable'}</dd>
          </div>
          <div className="rounded-lg bg-muted/30 p-3">
            <dt className="text-muted-foreground">Commit</dt>
            <dd className="mt-1 font-mono">{shortCommitSha(results.scan.sourceCommitSha)}</dd>
          </div>
        </dl>
      </header>

      <ScanMessages results={results} />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <article key={card.label} className="rounded-xl border bg-card p-5">
            <card.icon className="size-4 text-blue-700" aria-hidden="true" />
            <p className="mt-4 text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CountPanel
          title="Languages"
          counts={formatCounts(statistics.languageCounts)}
        />
        <CountPanel
          title="Categories"
          counts={formatCounts(statistics.categoryCounts)}
        />
      </section>

      <SystemMapSeedView seed={results.systemMapSeed} />

      <InventoryPreview results={results} />
    </div>
  )
}

export function ScanResultsUnavailable() {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border bg-card p-6">
      <ShieldAlert className="size-5 text-destructive" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-semibold">Scan results unavailable</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        The scan results could not be loaded safely. No internal error details were exposed.
      </p>
      <Link href="/dashboard/import" className="mt-5 inline-block text-sm text-blue-700 hover:underline">
        Return to repository intake
      </Link>
    </div>
  )
}
