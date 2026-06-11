import {
  buildChatContext,
  type CompiledContext,
} from '@/lib/ai/context-builder'
import { validateChatRequest } from '@/lib/ai/model-policy'
import {
  chatWithOllama,
  OllamaClientError,
  type OllamaChatResponse,
} from '@/lib/ai/ollama-client'
import { logError, logInfo, logWarn } from '@/lib/logger/server'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 550_000

function errorResponse(status: number, error: string): Response {
  return Response.json({ ok: false, error }, { status })
}

function providerErrorResponse(error: unknown): Response {
  if (error instanceof OllamaClientError) {
    if (error.code === 'config') {
      return errorResponse(500, 'AI service is not configured')
    }

    if (error.code === 'timeout') {
      return errorResponse(
        504,
        'AI response timed out. Ask for a shorter reply and try again.'
      )
    }
  }

  return errorResponse(502, 'AI service is unavailable')
}

function safeChatResponse(
  response: OllamaChatResponse,
  model: string,
  compiledContext: CompiledContext
): Response {
  return Response.json({
    ok: true,
    model: response.model ?? model,
    message: response.message ?? null,
    usage: {
      prompt_tokens: response.prompt_eval_count ?? null,
      completion_tokens: response.eval_count ?? null,
    },
    timing: {
      total_duration: response.total_duration ?? null,
      load_duration: response.load_duration ?? null,
      prompt_eval_duration: response.prompt_eval_duration ?? null,
      eval_duration: response.eval_duration ?? null,
    },
    done: response.done ?? null,
    done_reason: response.done_reason ?? null,
    context: {
      estimated_input_tokens: compiledContext.estimatedInputTokens,
      max_input_tokens: compiledContext.maxInputTokens,
      included_recent_messages: compiledContext.includedRecentMessages,
      included_relevant_context_items:
        compiledContext.includedRelevantContextItems,
    },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return errorResponse(415, 'Content-Type must be application/json')
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0)

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'Request body is too large')
  }

  let rawBody: string

  try {
    rawBody = await request.text()
  } catch {
    return errorResponse(400, 'Invalid JSON request body')
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return errorResponse(413, 'Request body is too large')
  }

  let payload: unknown

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return errorResponse(400, 'Invalid JSON request body')
  }

  const validation = validateChatRequest(payload)

  if (!validation.ok) {
    return errorResponse(400, validation.reason)
  }

  const compiledContext = buildChatContext(
    validation.value.context,
    validation.value.contextConfig
  )
  const chatInput = {
    model: validation.value.model,
    options: validation.value.options,
    messages: compiledContext.messages,
    timeoutMs: validation.value.contextConfig.chatTimeoutMs,
  }

  try {
    const response = await chatWithOllama(chatInput)

    await logInfo({
      message: 'Ollama chat request completed',
      route: '/api/ai/chat',
      context: {
        model: response.model ?? validation.value.model,
        message_count: compiledContext.messages.length,
        estimated_input_tokens: compiledContext.estimatedInputTokens,
        included_recent_messages: compiledContext.includedRecentMessages,
        included_relevant_context_items:
          compiledContext.includedRelevantContextItems,
        prompt_tokens: response.prompt_eval_count ?? null,
        completion_tokens: response.eval_count ?? null,
        total_duration: response.total_duration ?? null,
        timeout_ms: validation.value.contextConfig.chatTimeoutMs,
      },
    })

    return safeChatResponse(response, validation.value.model, compiledContext)
  } catch (error) {
    const code =
      error instanceof OllamaClientError ? error.code : 'unexpected'
    const log = code === 'config' ? logError : logWarn

    await log({
      message: 'Ollama chat request failed',
      route: '/api/ai/chat',
      context: {
        code,
        timeout_ms: validation.value.contextConfig.chatTimeoutMs,
      },
    })

    return providerErrorResponse(error)
  }
}
