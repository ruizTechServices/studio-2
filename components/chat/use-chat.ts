'use client'

import { useState } from 'react'

import type { ChatMessage } from '@/lib/ai/chat-contract'
import { compactConversation } from '@/lib/ai/conversation-summary'

import { sendChat } from './chat-client'
import { getVisibleChatMessages } from './chat-history'
import {
  logChatFailed,
  logChatSubmitted,
  logChatSucceeded,
} from './chat-telemetry'
import type { ChatState, DisplayChatMessage } from './types'

export function useChat(
  endpoint: string,
  systemPrompt: string,
  relevantContext: string[]
): ChatState {
  const [visibleMessages, setVisibleMessages] = useState<DisplayChatMessage[]>(
    []
  )
  const [recentMessages, setRecentMessages] = useState<ChatMessage[]>([])
  const [summary, setSummary] = useState('')
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)

  async function submitPrompt(): Promise<void> {
    const content = prompt.trim()

    if (!content || isSending) {
      return
    }

    const currentMessage: ChatMessage = { role: 'user', content }
    const requestState = compactConversation(summary, [
      ...recentMessages,
      currentMessage,
    ])

    setSummary(requestState.summary)
    setRecentMessages(requestState.recentMessages)
    setVisibleMessages((messages) =>
      getVisibleChatMessages([...messages, currentMessage])
    )
    setPrompt('')
    setError(null)
    setIsSending(true)
    const startedAt = performance.now()

    logChatSubmitted({
      recentMessageCount: requestState.recentMessages.length,
      endpoint,
    })

    try {
      const result = await sendChat(endpoint, {
        context: {
          systemPrompt,
          summary: requestState.summary,
          recentMessages: requestState.recentMessages,
          relevantContext,
          currentMessage,
        },
      })
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.content,
      }
      const responseState = compactConversation(requestState.summary, [
        ...requestState.recentMessages,
        assistantMessage,
      ])

      setSummary(responseState.summary)
      setRecentMessages(responseState.recentMessages)
      setVisibleMessages((messages) =>
        getVisibleChatMessages([
          ...messages,
          { ...assistantMessage, doneReason: result.doneReason },
        ])
      )

      logChatSucceeded({
        recentMessageCount: requestState.recentMessages.length,
        responseLength: result.content.length,
        durationMs: Math.round(performance.now() - startedAt),
        endpoint,
      })
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The AI service is unavailable.'
      )

      logChatFailed({
        recentMessageCount: requestState.recentMessages.length,
        durationMs: Math.round(performance.now() - startedAt),
        endpoint,
      })
    } finally {
      setIsSending(false)
    }
  }

  return {
    messages: visibleMessages,
    prompt,
    error,
    isSending,
    setPrompt,
    submitPrompt,
  }
}
