import { LoaderCircle } from 'lucide-react'

import { ChatMessage } from './chat-message'
import type { DisplayChatMessage } from './types'

interface ChatMessagesProps {
  messages: DisplayChatMessage[]
  isSending: boolean
}

export function ChatMessages({ messages, isSending }: ChatMessagesProps) {
  return (
    <div className="flex min-h-64 flex-col justify-end gap-3 px-5 py-5">
      {messages.length === 0 ? (
        <div className="m-auto max-w-sm py-8 text-center">
          <p className="text-sm font-medium">What are you working on?</p>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Ask a question. The model receives token-budgeted conversation and
            project context.
          </p>
        </div>
      ) : (
        messages.map((message, index) => (
          <ChatMessage
            key={`${message.role}-${index}-${message.content.slice(0, 24)}`}
            message={message}
          />
        ))
      )}

      {isSending ? (
        <div
          aria-label="Waiting for response"
          className="mr-auto flex items-center gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-sm text-muted-foreground"
        >
          <LoaderCircle className="size-4 animate-spin" />
          Thinking
        </div>
      ) : null}
    </div>
  )
}
