import { logInfo, logWarn } from '@/lib/logger/client'

interface ChatRequestMetadata {
  recentMessageCount: number
  endpoint: string
}

interface ChatResponseMetadata extends ChatRequestMetadata {
  durationMs: number
  responseLength: number
}

interface ChatFailureMetadata extends ChatRequestMetadata {
  durationMs: number
}

export function logChatSubmitted(metadata: ChatRequestMetadata): void {
  void logInfo({
    message: 'Local chat prompt submitted',
    context: {
      recent_message_count: metadata.recentMessageCount,
      endpoint: metadata.endpoint,
    },
  })
}

export function logChatSucceeded(metadata: ChatResponseMetadata): void {
  void logInfo({
    message: 'Local chat response received',
    context: {
      recent_message_count: metadata.recentMessageCount,
      response_length: metadata.responseLength,
      duration_ms: metadata.durationMs,
      endpoint: metadata.endpoint,
    },
  })
}

export function logChatFailed(metadata: ChatFailureMetadata): void {
  void logWarn({
    message: 'Local chat request failed',
    context: {
      recent_message_count: metadata.recentMessageCount,
      duration_ms: metadata.durationMs,
      endpoint: metadata.endpoint,
    },
  })
}
