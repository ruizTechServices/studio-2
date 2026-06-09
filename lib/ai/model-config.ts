export interface ModelContextConfig {
  numCtx: number
  numPredict: number
  reservedResponseTokens: number
  maxRelevantContextItems: number
  maxSummaryTokens: number
  maxRecentMessageTokens: number
}

export interface ModelRequestConfig extends ModelContextConfig {
  chatTimeoutMs: number
}

export const DEFAULT_MODEL_CONTEXT_CONFIG: ModelRequestConfig = {
  numCtx: 4096,
  numPredict: 256,
  reservedResponseTokens: 256,
  chatTimeoutMs: 120_000,
  maxRelevantContextItems: 8,
  maxSummaryTokens: 512,
  maxRecentMessageTokens: 2048,
}

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export function getModelContextConfig(): ModelRequestConfig {
  const numCtx = readPositiveInteger(
    process.env.OLLAMA_NUM_CTX,
    DEFAULT_MODEL_CONTEXT_CONFIG.numCtx
  )
  const numPredict = readPositiveInteger(
    process.env.OLLAMA_NUM_PREDICT,
    DEFAULT_MODEL_CONTEXT_CONFIG.numPredict
  )
  const reservedResponseTokens = Math.min(
    readPositiveInteger(
      process.env.OLLAMA_RESERVED_RESPONSE_TOKENS,
      DEFAULT_MODEL_CONTEXT_CONFIG.reservedResponseTokens
    ),
    numCtx - 1
  )
  const chatTimeoutMs = readPositiveInteger(
    process.env.OLLAMA_CHAT_TIMEOUT_MS,
    DEFAULT_MODEL_CONTEXT_CONFIG.chatTimeoutMs
  )

  return {
    ...DEFAULT_MODEL_CONTEXT_CONFIG,
    numCtx,
    numPredict,
    reservedResponseTokens,
    chatTimeoutMs,
  }
}
