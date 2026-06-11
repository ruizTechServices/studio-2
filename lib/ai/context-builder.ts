import type {
  ChatMessage,
  ConversationContext,
} from '@/lib/ai/chat-contract'
import {
  DEFAULT_MODEL_CONTEXT_CONFIG,
  type ModelContextConfig,
} from '@/lib/ai/model-config'
import {
  estimateMessageTokens,
  estimateMessagesTokens,
  getMaxInputTokens,
  truncateTextToTokens,
} from '@/lib/ai/token-budget'

const SUMMARY_PREFIX = 'Conversation summary:\n'
const RELEVANT_CONTEXT_PREFIX = 'Relevant project context:\n'

export interface CompiledContext {
  messages: ChatMessage[]
  estimatedInputTokens: number
  maxInputTokens: number
  includedRecentMessages: number
  includedRelevantContextItems: number
}

function sameMessage(left: ChatMessage, right: ChatMessage): boolean {
  return left.role === right.role && left.content === right.content
}

function createSystemMessage(content: string): ChatMessage {
  return { role: 'system', content }
}

export function buildChatContext(
  context: ConversationContext,
  config: ModelContextConfig = DEFAULT_MODEL_CONTEXT_CONFIG
): CompiledContext {
  const maxInputTokens = getMaxInputTokens(
    config.numCtx,
    config.reservedResponseTokens
  )
  const systemMessage = createSystemMessage(context.systemPrompt)
  const currentMessage =
    context.currentMessage ?? context.recentMessages.at(-1)
  const requiredTokens =
    estimateMessageTokens(systemMessage) +
    (currentMessage ? estimateMessageTokens(currentMessage) : 0)
  let remainingTokens = Math.max(0, maxInputTokens - requiredTokens)

  const prefixMessages: ChatMessage[] = [systemMessage]
  const summary = context.summary.trim()

  if (summary) {
    const summaryMessage = createSystemMessage(
      `${SUMMARY_PREFIX}${truncateTextToTokens(
        summary,
        config.maxSummaryTokens
      )}`
    )
    const summaryTokens = estimateMessageTokens(summaryMessage)

    if (summaryTokens <= remainingTokens) {
      prefixMessages.push(summaryMessage)
      remainingTokens -= summaryTokens
    }
  }

  const selectedRelevantContext: string[] = []

  for (const item of context.relevantContext.slice(
    0,
    config.maxRelevantContextItems
  )) {
    const candidateItems = [...selectedRelevantContext, item]
    const candidateMessage = createSystemMessage(
      `${RELEVANT_CONTEXT_PREFIX}${candidateItems.join('\n\n')}`
    )
    const candidateTokens = estimateMessageTokens(candidateMessage)

    if (candidateTokens > remainingTokens) {
      break
    }

    selectedRelevantContext.push(item)
  }

  if (selectedRelevantContext.length > 0) {
    const relevantMessage = createSystemMessage(
      `${RELEVANT_CONTEXT_PREFIX}${selectedRelevantContext.join('\n\n')}`
    )
    prefixMessages.push(relevantMessage)
    remainingTokens -= estimateMessageTokens(relevantMessage)
  }

  const recentCandidates = context.recentMessages.filter(
    (message, index, messages) =>
      !currentMessage ||
      index !== messages.length - 1 ||
      !sameMessage(message, currentMessage)
  )
  const selectedRecentMessages: ChatMessage[] = []

  for (let index = recentCandidates.length - 1; index >= 0; index -= 1) {
    const message = recentCandidates[index]
    const messageTokens = estimateMessageTokens(message)

    if (messageTokens > remainingTokens) {
      continue
    }

    selectedRecentMessages.unshift(message)
    remainingTokens -= messageTokens
  }

  const messages = [
    ...prefixMessages,
    ...selectedRecentMessages,
    ...(currentMessage ? [currentMessage] : []),
  ]

  return {
    messages,
    estimatedInputTokens: estimateMessagesTokens(messages),
    maxInputTokens,
    includedRecentMessages: selectedRecentMessages.length,
    includedRelevantContextItems: selectedRelevantContext.length,
  }
}
