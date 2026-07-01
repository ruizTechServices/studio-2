'use client'

import { useState } from 'react'
import { Library } from 'lucide-react'

import type { ReusableAssetCandidate } from '@/lib/intake/reusable-assets/contracts'
import { cn } from '@/lib/utils'

type PromotionState = 'idle' | 'saving' | 'shelved' | 'error'

const LABELS: Readonly<Record<PromotionState, string>> = {
  idle: 'Add to shelf',
  saving: 'Shelving…',
  shelved: 'On shelf',
  error: 'Retry shelving',
}

/**
 * Promotes one deterministic candidate into the durable shelf library via
 * POST /api/shelves/promote. Local-only, like the rest of the intake surface.
 */
export function PromoteCandidateButton({
  candidate,
}: Readonly<{ candidate: ReusableAssetCandidate }>) {
  const [state, setState] = useState<PromotionState>('idle')

  async function promote() {
    if (state === 'saving' || state === 'shelved') return
    setState('saving')
    try {
      const response = await fetch('/api/shelves/promote', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scanId: candidate.scanId,
          projectId: candidate.projectId,
          relativePath: candidate.relativePath,
          symbolName: candidate.symbolName,
          symbolKind: candidate.symbolKind,
        }),
      })
      setState(response.ok ? 'shelved' : 'error')
    } catch {
      setState('error')
    }
  }

  return (
    <button
      type="button"
      onClick={promote}
      disabled={state === 'saving' || state === 'shelved'}
      aria-live="polite"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors',
        state === 'shelved'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : state === 'error'
            ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
            : 'bg-card text-muted-foreground hover:bg-muted disabled:opacity-60'
      )}
    >
      <Library className="size-3" aria-hidden="true" />
      {LABELS[state]}
    </button>
  )
}
