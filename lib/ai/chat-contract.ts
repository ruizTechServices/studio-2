export const MAX_VISIBLE_CHAT_MESSAGES = 5
export const CHAT_ROLES = ['system', 'user', 'assistant'] as const

export type ChatRole = (typeof CHAT_ROLES)[number]

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ConversationContext {
  systemPrompt: string
  summary: string
  recentMessages: ChatMessage[]
  relevantContext: string[]
  currentMessage?: ChatMessage
}
