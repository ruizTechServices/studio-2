import { Boxes, FolderTree } from 'lucide-react'

import { formatBytes, formatCount } from '@/lib/intake/results/formatting'
import {
  SYSTEM_MAP_GROUP_KEYS,
  type SystemMapSeed,
} from '@/lib/intake/system-map/contracts'
import { formatSystemMapGroupLabel } from '@/lib/intake/system-map/formatting'

export function SystemMapSeedView({ seed }: Readonly<{ seed: SystemMapSeed }>) {
  const populatedGroups = SYSTEM_MAP_GROUP_KEYS.filter((key) => seed.counts[key] > 0)

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex gap-3">
        <FolderTree className="mt-0.5 size-5 shrink-0 text-blue-700" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold">Deterministic system overview</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Structure inferred from file metadata only. No source contents were inspected.
          </p>
        </div>
      </div>

      {seed.rootSummary.totalFiles === 0 ? (
        <div className="mt-5 rounded-lg bg-muted/30 p-5 text-center">
          <Boxes className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">No structure metadata available</p>
          <p className="mt-1 text-xs text-muted-foreground">{seed.warnings[0]}</p>
        </div>
      ) : (
        <>
          <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-muted/30 p-3">
              <dt className="text-muted-foreground">Files mapped</dt>
              <dd className="mt-1 text-lg font-semibold">
                {formatCount(seed.rootSummary.totalFiles)}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/30 p-3 sm:col-span-2">
              <dt className="text-muted-foreground">Framework hints</dt>
              <dd className="mt-1">
                {seed.rootSummary.detectedFrameworkHints.join(', ') || 'None detected'}
              </dd>
            </div>
          </dl>

          <div className="mt-5">
            <h3 className="text-xs font-semibold">Top-level directories</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {seed.rootSummary.topLevelDirectories.length > 0 ? (
                seed.rootSummary.topLevelDirectories.map((directory) => (
                  <span key={directory} className="rounded-md border px-2 py-1 font-mono text-[11px]">
                    {directory}
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">Root files only</span>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {populatedGroups.map((key) => (
              <article key={key} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold">{formatSystemMapGroupLabel(key)}</h3>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {formatCount(seed.counts[key])}
                  </span>
                </div>
                <ul className="mt-3 space-y-2">
                  {seed.groups[key].preview.map((file) => (
                    <li key={file.relativePath} className="flex justify-between gap-3 text-[11px]">
                      <span className="truncate font-mono">{file.relativePath}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatBytes(file.sizeBytes)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
