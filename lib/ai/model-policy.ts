import {
  CHAT_ROLES,
  type ChatMessage,
  type ChatRole,
  type ConversationContext,
} from '@/lib/ai/chat-contract'
import {
  getModelContextConfig,
  type ModelContextConfig,
  type ModelRequestConfig,
} from '@/lib/ai/model-config'
import {
  estimateMessageTokens,
  getMaxInputTokens,
} from '@/lib/ai/token-budget'

export const ALLOWED_MODELS = ['qwen2.5:7b-instruct-q4_K_M'] as const
export const DEFAULT_MODEL =
  process.env.OLLAMA_DEFAULT_MODEL ?? ALLOWED_MODELS[0]
export const MAX_MESSAGE_CONTENT_LENGTH = 20_000
export const MAX_SYSTEM_PROMPT_LENGTH = 8_000
export const MAX_SUMMARY_LENGTH = 12_000
export const MAX_RECENT_MESSAGES = 200
export const MAX_RELEVANT_CONTEXT_ITEMS = 20
export const MAX_RELEVANT_CONTEXT_ITEM_LENGTH = 20_000
export const ACCEPTED_ROLES = CHAT_ROLES

export type AllowedModel = (typeof ALLOWED_MODELS)[number]
export type { ChatMessage, ChatRole, ConversationContext }

export interface SafeUserOptions {
  num_ctx?: number
  num_predict?: number
}

export interface OllamaOptions {
  num_gpu: 2
  num_ctx: number
  num_predict: number
}

export type ChatRequestValidationResult =
  | {
      ok: true
      value: {
        context: ConversationContext
        model: AllowedModel
        options: OllamaOptions
        contextConfig: ModelRequestConfig
      }
    }
  | { ok: false; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAllowedModel(value: unknown): value is AllowedModel {
  return (
    typeof value === 'string' &&
    ALLOWED_MODELS.some((allowedModel) => allowedModel === value)
  )
}

function isAcceptedRole(value: unknown): value is ChatRole {
  return (
    typeof value === 'string' &&
    ACCEPTED_ROLES.some((acceptedRole) => acceptedRole === value)
  )
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
  )
}

function validateMessage(value: unknown): ChatMessage | null {
  if (
    !isRecord(value) ||
    !isAcceptedRole(value.role) ||
    typeof value.content !== 'string' ||
    value.content.trim().length === 0 ||
    value.content.length > MAX_MESSAGE_CONTENT_LENGTH
  ) {
    return null
  }

  return { role: value.role, content: value.content }
}

function validateMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length > MAX_RECENT_MESSAGES) {
    return null
  }

  const messages: ChatMessage[] = []

  for (const rawMessage of value) {
    const message = validateMessage(rawMessage)

    if (!message) {
      return null
    }

    messages.push(message)
  }

  return messages
}

function validateRelevantContext(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_RELEVANT_CONTEXT_ITEMS) {
    return null
  }

  if (
    value.some(
      (item) =>
        typeof item !== 'string' ||
        item.trim().length === 0 ||
        item.length > MAX_RELEVANT_CONTEXT_ITEM_LENGTH
    )
  ) {
    return null
  }

  return value as string[]
}

function validateContext(value: unknown): ConversationContext | null {
  if (
    !isRecord(value) ||
    typeof value.systemPrompt !== 'string' ||
    value.systemPrompt.trim().length === 0 ||
    value.systemPrompt.length > MAX_SYSTEM_PROMPT_LENGTH ||
    typeof value.summary !== 'string' ||
    value.summary.length > MAX_SUMMARY_LENGTH
  ) {
    return null
  }

  const recentMessages = validateMessages(value.recentMessages)
  const relevantContext = validateRelevantContext(value.relevantContext)
  const currentMessage =
    value.currentMessage === undefined
      ? undefined
      : validateMessage(value.currentMessage)

  if (!recentMessages || !relevantContext || value.currentMessage && !currentMessage) {
    return null
  }

  if (recentMessages.length === 0 && !currentMessage) {
    return null
  }

  return {
    systemPrompt: value.systemPrompt,
    summary: value.summary,
    recentMessages,
    relevantContext,
    currentMessage: currentMessage ?? undefined,
  }
}

function validateOptions(
  value: unknown,
  config: ModelContextConfig
): SafeUserOptions | null {
  if (value === undefined) {
    return {}
  }

  if (!isRecord(value)) {
    return null
  }

  const keys = Object.keys(value)

  if (keys.some((key) => key !== 'num_ctx' && key !== 'num_predict')) {
    return null
  }

  if (
    value.num_ctx !== undefined &&
    !isIntegerInRange(value.num_ctx, 1024, config.numCtx)
  ) {
    return null
  }

  if (
    value.num_predict !== undefined &&
    !isIntegerInRange(value.num_predict, 1, config.numPredict)
  ) {
    return null
  }

  return {
    num_ctx: value.num_ctx as number | undefined,
    num_predict: value.num_predict as number | undefined,
  }
}

export function validateChatRequest(
  input: unknown
): ChatRequestValidationResult {
  if (!isRecord(input)) {
    return { ok: false, reason: 'Request body must be an object' }
  }

  const context = validateContext(input.context)

  if (!context) {
    return { ok: false, reason: 'Invalid conversation context' }
  }

  const requestedModel = input.model ?? DEFAULT_MODEL

  if (!isAllowedModel(requestedModel)) {
    return { ok: false, reason: 'Model is not allowed' }
  }

  const contextConfig = getModelContextConfig()
  const userOptions = validateOptions(input.options, contextConfig)

  if (!userOptions) {
    return { ok: false, reason: 'Options contain unsupported or unsafe values' }
  }

  const numCtx = userOptions.num_ctx ?? contextConfig.numCtx
  const numPredict = userOptions.num_predict ?? contextConfig.numPredict
  const currentMessage =
    context.currentMessage ?? context.recentMessages.at(-1)
  const requiredTokens =
    estimateMessageTokens({ role: 'system', content: context.systemPrompt }) +
    (currentMessage ? estimateMessageTokens(currentMessage) : 0)
  const reservedResponseTokens = Math.min(
    contextConfig.reservedResponseTokens,
    numCtx - 1
  )

  if (requiredTokens > getMaxInputTokens(numCtx, reservedResponseTokens)) {
    return { ok: false, reason: 'Required conversation context is too large' }
  }

  return {
    ok: true,
    value: {
      context,
      model: requestedModel,
      options: {
        num_gpu: 2,
        num_ctx: numCtx,
        num_predict: numPredict,
      },
      contextConfig: {
        ...contextConfig,
        numCtx,
        numPredict,
        reservedResponseTokens,
      },
    },
  }
}
