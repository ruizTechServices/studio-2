import type {
  ChatMessage,
  ConversationContext,
} from '@/lib/ai/chat-contract'

export interface ChatCardProps {
  endpoint?: string
  title?: string
  subtitle?: string
  disclosure?: string
  systemPrompt?: string
  relevantContext?: string[]
  className?: string
}

export interface ChatApiResponse {
  ok: boolean
  message?: {
    role?: string
    content?: string
  } | null
  done_reason?: string | null
  error?: string
}

export interface ChatRequest {
  context: ConversationContext
}

export interface ChatResult {
  content: string
  doneReason: string | null
}

export interface DisplayChatMessage extends ChatMessage {
  doneReason?: string | null
}

export interface ChatState {
  messages: DisplayChatMessage[]
  prompt: string
  error: string | null
  isSending: boolean
  setPrompt: (prompt: string) => void
  submitPrompt: () => Promise<void>
}
