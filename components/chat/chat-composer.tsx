import type { FormEvent } from 'react'
import { ArrowUp, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface ChatComposerProps {
  prompt: string
  error: string | null
  isSending: boolean
  onPromptChange: (prompt: string) => void
  onSubmit: () => Promise<void>
}

export function ChatComposer({
  prompt,
  error,
  isSending,
  onPromptChange,
  onSubmit,
}: ChatComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void onSubmit()
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-2 px-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/30"
      >
        <label htmlFor="chat-prompt" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-prompt"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="Message local AI"
          rows={1}
          disabled={isSending}
          className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={isSending || prompt.trim().length === 0}
        >
          {isSending ? <LoaderCircle className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </>
  )
}
