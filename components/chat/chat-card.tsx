'use client'

import { MAX_VISIBLE_CHAT_MESSAGES } from '@/lib/ai/chat-contract'
import { cn } from '@/lib/utils'

import { ChatComposer } from './chat-composer'
import { ChatDisclosure } from './chat-disclosure'
import { ChatHeader } from './chat-header'
import { ChatMessages } from './chat-messages'
import type { ChatCardProps } from './types'
import { useChat } from './use-chat'

const DEFAULT_DISCLOSURE =
  'Only the latest five messages are displayed. The stateless backend receives a token-budgeted context containing a permanent system prompt, rolling summary, relevant project context, and recent conversation.'
const DEFAULT_SYSTEM_PROMPT =
  'You are the local codebase intelligence assistant for ruizTechStudio. Help the user understand, recover, visualize, and improve software projects. Answer directly and default to three to six concise sentences or short bullets unless the user requests detail. Be technically rigorous and explicit about uncertainty.'

export function ChatCard({
  endpoint = '/api/ai/chat',
  title = 'Local chat',
  subtitle = 'Orin Nano | token-budgeted context',
  disclosure = DEFAULT_DISCLOSURE,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  relevantContext = [],
  className,
}: ChatCardProps) {
  const chat = useChat(endpoint, systemPrompt, relevantContext)

  return (
    <section
      aria-label={title}
      className={cn(
        'w-full max-w-2xl overflow-hidden rounded-2xl border bg-card shadow-sm',
        className
      )}
    >
      <ChatHeader
        title={title}
        subtitle={subtitle}
        messageCount={chat.messages.length}
        maxMessages={MAX_VISIBLE_CHAT_MESSAGES}
      />
      <ChatMessages messages={chat.messages} isSending={chat.isSending} />
      <div className="border-t p-3">
        <ChatComposer
          prompt={chat.prompt}
          error={chat.error}
          isSending={chat.isSending}
          onPromptChange={chat.setPrompt}
          onSubmit={chat.submitPrompt}
        />
        <ChatDisclosure>{disclosure}</ChatDisclosure>
      </div>
    </section>
  )
}
