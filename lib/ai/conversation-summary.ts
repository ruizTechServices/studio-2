import type { ChatMessage } from '@/lib/ai/chat-contract'
import { DEFAULT_MODEL_CONTEXT_CONFIG } from '@/lib/ai/model-config'
import {
  estimateMessagesTokens,
  truncateTextToLastTokens,
  truncateTextToTokens,
} from '@/lib/ai/token-budget'

export interface CompactConversationResult {
  summary: string
  recentMessages: ChatMessage[]
}

function summarizeMessage(message: ChatMessage): string {
  const label =
    message.role === 'user'
      ? 'User'
      : message.role === 'assistant'
        ? 'Assistant'
        : 'System'
  const content = message.content.replace(/\s+/g, ' ').trim()

  return `${label}: ${truncateTextToTokens(content, 80)}`
}

export function updateConversationSummary(
  existingSummary: string,
  messages: ChatMessage[],
  maxSummaryTokens = DEFAULT_MODEL_CONTEXT_CONFIG.maxSummaryTokens
): string {
  const additions = messages.map(summarizeMessage).join('\n')
  const combined = [existingSummary.trim(), additions]
    .filter(Boolean)
    .join('\n')

  return truncateTextToLastTokens(combined, maxSummaryTokens)
}

export function compactConversation(
  summary: string,
  messages: ChatMessage[],
  maxRecentMessageTokens = DEFAULT_MODEL_CONTEXT_CONFIG.maxRecentMessageTokens
): CompactConversationResult {
  const recentMessages = [...messages]
  const removedMessages: ChatMessage[] = []

  while (
    recentMessages.length > 1 &&
    estimateMessagesTokens(recentMessages) > maxRecentMessageTokens
  ) {
    const removedMessage = recentMessages.shift()

    if (removedMessage) {
      removedMessages.push(removedMessage)
    }
  }

  return {
    summary:
      removedMessages.length > 0
        ? updateConversationSummary(summary, removedMessages)
        : summary,
    recentMessages,
  }
}
