import { Braces } from 'lucide-react'

import type { SymbolSummary } from '@/lib/intake/symbols/contracts'

export function SymbolSummaryView({ summary }: Readonly<{ summary: SymbolSummary }>) {
  const counts = Object.entries(summary.counts).filter(([, count]) => count > 0)

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <div className="border-b p-5">
        <div className="flex items-center gap-2">
          <Braces className="size-4 text-blue-700" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Symbol Summary</h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {summary.total.toLocaleString()} deterministic metadata-only symbols.
        </p>
      </div>
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-wrap content-start gap-2">
          {counts.length > 0 ? counts.map(([kind, count]) => (
            <span key={kind} className="rounded-full border bg-muted/30 px-3 py-1 text-xs">
              {kind}: <span className="font-mono text-muted-foreground">{count}</span>
            </span>
          )) : <p className="text-xs text-muted-foreground">No symbols were detected.</p>}
        </div>
        <div className="space-y-2">
          {summary.preview.map((symbol, index) => (
            <div
              key={`${symbol.relativePath}-${symbol.lineStart}-${symbol.kind}-${symbol.name}-${index}`}
              className="rounded-lg bg-muted/30 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-mono font-medium">{symbol.name}</span>
                <span className="text-muted-foreground">{symbol.kind}</span>
              </div>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                {symbol.relativePath}{symbol.lineStart ? `:${symbol.lineStart}` : ''}
                {symbol.importSource ? ` from ${symbol.importSource}` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
