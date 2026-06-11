import type {
  AllowedModel,
  ChatMessage,
  OllamaOptions,
} from '@/lib/ai/model-policy'

const HEALTH_TIMEOUT_MS = 5_000

export type OllamaClientErrorCode = 'config' | 'provider' | 'timeout'

export class OllamaClientError extends Error {
  constructor(
    public readonly code: OllamaClientErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'OllamaClientError'
  }
}

export interface OllamaChatResponse {
  model?: string
  message?: {
    role?: string
    content?: string
  }
  done?: boolean
  done_reason?: string
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>
}

export interface ChatWithOllamaInput {
  model: AllowedModel
  messages: ChatMessage[]
  options: OllamaOptions
  timeoutMs: number
}

function getBaseUrl(): string {
  const baseUrl = process.env.OLLAMA_GPU_BASE_URL?.trim()

  if (!baseUrl) {
    throw new OllamaClientError(
      'config',
      'Ollama server is not configured'
    )
  }

  try {
    const url = new URL(baseUrl)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('Unsupported protocol')
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    throw new OllamaClientError(
      'config',
      'Ollama server configuration is invalid'
    )
  }
}

async function requestOllama<T>(
  path: string,
  init: RequestInit,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${getBaseUrl()}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new OllamaClientError(
        'provider',
        'Ollama server returned an error'
      )
    }

    try {
      return (await response.json()) as T
    } catch {
      throw new OllamaClientError(
        'provider',
        'Ollama server returned an invalid response'
      )
    }
  } catch (error) {
    if (error instanceof OllamaClientError) {
      throw error
    }

    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new OllamaClientError('timeout', 'Ollama request timed out')
    }

    throw new OllamaClientError(
      'provider',
      'Unable to connect to the Ollama server'
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function chatWithOllama(
  input: ChatWithOllamaInput
): Promise<OllamaChatResponse> {
  return requestOllama<OllamaChatResponse>(
    '/api/chat',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: input.model,
        messages: input.messages,
        options: input.options,
        stream: false,
        keep_alive: '5m',
      }),
    },
    input.timeoutMs
  )
}

export async function getOllamaModels(): Promise<string[]> {
  const response = await requestOllama<OllamaTagsResponse>(
    '/api/tags',
    { method: 'GET' },
    HEALTH_TIMEOUT_MS
  )

  return (response.models ?? [])
    .map((model) => model.name ?? model.model)
    .filter((name): name is string => typeof name === 'string')
}
