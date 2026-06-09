'use client'

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'

import { shouldShowMessageExpansion } from './message-preview'
import type { DisplayChatMessage } from './types'

interface ChatMessageProps {
  message: DisplayChatMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const canExpand = shouldShowMessageExpansion(message.content)
  const wasProviderTruncated = message.doneReason === 'length'

  return (
    <article
      className={cn(
        'max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-6',
        message.role === 'user'
          ? 'ml-auto bg-primary text-primary-foreground'
          : 'mr-auto bg-muted text-foreground'
      )}
    >
      <p
        className={cn(
          'whitespace-pre-wrap',
          canExpand && !isExpanded ? 'line-clamp-4' : null
        )}
      >
        {message.content}
      </p>

      {canExpand ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className={cn(
            'mt-1.5 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline',
            message.role === 'user'
              ? 'text-primary-foreground/75'
              : 'text-muted-foreground'
          )}
        >
          {isExpanded ? (
            <>
              Show less
              <ChevronUp className="size-3.5" />
            </>
          ) : (
            <>
              Show more
              <ChevronDown className="size-3.5" />
            </>
          )}
        </button>
      ) : null}

      {wasProviderTruncated ? (
        <p
          role="status"
          className="mt-2 flex items-start gap-1.5 border-t border-amber-500/30 pt-2 text-xs text-amber-700"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          The model reached its response-token limit. This response is
          incomplete.
        </p>
      ) : null}
    </article>
  )
}
