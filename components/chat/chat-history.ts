import {
  MAX_VISIBLE_CHAT_MESSAGES,
} from '@/lib/ai/chat-contract'

export function getVisibleChatMessages<T>(messages: T[]): T[] {
  return messages.slice(-MAX_VISIBLE_CHAT_MESSAGES)
}
