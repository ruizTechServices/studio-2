import type { ChatMessage } from '@/lib/ai/chat-contract'

const CHARACTERS_PER_TOKEN = 4
const MESSAGE_OVERHEAD_TOKENS = 4

export function estimateTextTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARACTERS_PER_TOKEN))
}

export function estimateMessageTokens(message: ChatMessage): number {
  return MESSAGE_OVERHEAD_TOKENS + estimateTextTokens(message.content)
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce(
    (total, message) => total + estimateMessageTokens(message),
    0
  )
}

export function getMaxInputTokens(
  numCtx: number,
  reservedResponseTokens: number
): number {
  return Math.max(1, numCtx - reservedResponseTokens)
}

export function truncateTextToTokens(text: string, maxTokens: number): string {
  if (estimateTextTokens(text) <= maxTokens) {
    return text
  }

  const maxCharacters = Math.max(0, maxTokens * CHARACTERS_PER_TOKEN - 3)

  return `${text.slice(0, maxCharacters).trimEnd()}...`
}

export function truncateTextToLastTokens(
  text: string,
  maxTokens: number
): string {
  if (estimateTextTokens(text) <= maxTokens) {
    return text
  }

  const maxCharacters = Math.max(0, maxTokens * CHARACTERS_PER_TOKEN - 3)

  return `...${text.slice(-maxCharacters).trimStart()}`
}
