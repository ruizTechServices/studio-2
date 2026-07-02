'use client'

import { useState } from 'react'
import { Code, Loader2 } from 'lucide-react'

import type { ShelfSourcePreview } from '@/lib/shelves/retrieval/contracts'
import { cn } from '@/lib/utils'

type PanelState =
  | { readonly phase: 'idle' | 'loading' }
  | { readonly phase: 'error'; readonly message: string }
  | { readonly phase: 'loaded'; readonly preview: ShelfSourcePreview }

/**
 * On-demand bounded source preview for one shelf asset. The preview is
 * fetched from GitHub at the pinned commit when opened and is never stored.
 */
export function SourcePreviewPanel({ assetId }: Readonly<{ assetId: string }>) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<PanelState>({ phase: 'idle' })

  async function toggle() {
    const next = !open
    setOpen(next)
    if (!next || state.phase === 'loaded' || state.phase === 'loading') return
    setState({ phase: 'loading' })
    try {
      const response = await fetch(`/api/shelves/${assetId}/source`)
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        setState({
          phase: 'error',
          message: body?.error ?? 'Source preview is unavailable.',
        })
        return
      }
      const preview = (await response.json()) as ShelfSourcePreview
      setState({ phase: 'loaded', preview })
    } catch {
      setState({ phase: 'error', message: 'Source preview is unavailable.' })
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
          'bg-card text-muted-foreground hover:bg-muted'
        )}
      >
        {state.phase === 'loading' ? (
          <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        ) : (
          <Code className="size-3" aria-hidden="true" />
        )}
        {open ? 'Hide source' : 'Preview source'}
      </button>

      {open && state.phase === 'error' ? (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
          {state.message}
        </p>
      ) : null}

      {open && state.phase === 'loaded' ? (
        <div className="mt-2 overflow-hidden rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-[10px] text-muted-foreground">
            <p className="truncate font-mono">
              {state.preview.sourceOwner}/{state.preview.sourceRepository} @{' '}
              {state.preview.sourceCommitSha.slice(0, 7)} ·{' '}
              {state.preview.relativePath}:{state.preview.lineStart}–
              {state.preview.lineEnd}
              {state.preview.truncatedByLineLimit ? ' (truncated)' : ''}
            </p>
            <p className="mt-1">
              Fetched on demand from the pinned commit — never stored.{' '}
              <a
                href={`https://github.com/${state.preview.sourceOwner}/${state.preview.sourceRepository}/blob/${state.preview.sourceCommitSha}/${state.preview.relativePath}#L${state.preview.lineStart}-L${state.preview.lineEnd}`}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-foreground"
              >
                View on GitHub
              </a>
            </p>
          </div>
          <pre className="max-h-72 overflow-auto bg-muted/20 p-3 text-[11px] leading-5">
            {state.preview.lines.map((line) => (
              <code key={line.number} className="block whitespace-pre">
                <span className="mr-3 inline-block w-8 select-none text-right text-muted-foreground">
                  {line.number}
                </span>
                {line.text}
                {line.truncated ? ' …' : ''}
              </code>
            ))}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
