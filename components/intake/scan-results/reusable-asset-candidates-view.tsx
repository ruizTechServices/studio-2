import { PackageSearch } from 'lucide-react'

import type { ReusableAssetSummary } from '@/lib/intake/reusable-assets/contracts'

export function ReusableAssetCandidatesView({
  summary,
}: Readonly<{ summary: ReusableAssetSummary }>) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-5">
        <div className="flex items-center gap-2">
          <PackageSearch className="size-4 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Reusable Asset Candidates</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {summary.total.toLocaleString()} deterministic metadata-only candidates. Review before reuse.
        </p>
      </div>
      {summary.preview.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm font-medium">No reusable asset candidates available</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This scan did not produce strong deterministic candidates.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 p-5 md:grid-cols-2">
          {summary.preview.map((candidate) => (
            <article
              key={`${candidate.relativePath}-${candidate.symbolKind}-${candidate.symbolName}`}
              className="rounded-lg bg-muted/30 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-mono text-xs font-semibold">{candidate.symbolName}</h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {candidate.assetKind.replaceAll('_', ' ')}
                  </p>
                </div>
                <span className="rounded-full border bg-card px-2 py-1 font-mono text-[10px]">
                  {candidate.reuseScore} · {candidate.confidence}
                </span>
              </div>
              <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground">
                {candidate.relativePath}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1">
                {candidate.reasons.map((reason) => (
                  <li key={reason} className="rounded bg-card px-2 py-1 text-[10px] text-muted-foreground">
                    {reason}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
