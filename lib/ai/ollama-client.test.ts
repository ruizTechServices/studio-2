import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  chatWithOllama,
  getOllamaModels,
  OllamaClientError,
} from '@/lib/ai/ollama-client'

const CHAT_INPUT = {
  model: 'qwen2.5:7b-instruct-q4_K_M' as const,
  messages: [{ role: 'user' as const, content: 'hello' }],
  options: { num_gpu: 2 as const, num_ctx: 4096, num_predict: 256 },
  timeoutMs: 120_000,
}

beforeEach(() => {
  vi.stubEnv('OLLAMA_GPU_BASE_URL', 'http://ollama.test:11435/')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('chatWithOllama', () => {
  it('sends a non-streaming request with forced provider settings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ model: CHAT_INPUT.model, message: { content: 'hi' } })
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    await chatWithOllama(CHAT_INPUT)

    expect(fetchMock).toHaveBeenCalledWith(
      'http://ollama.test:11435/api/chat',
      expect.objectContaining({
        method: 'POST',
        cache: 'no-store',
      })
    )
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(JSON.parse(init.body as string)).toMatchObject({
      stream: false,
      keep_alive: '5m',
      options: { num_gpu: 2, num_ctx: 4096, num_predict: 256 },
    })
  })

  it('classifies non-2xx responses as provider errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('failure', { status: 500 }))
    )

    await expect(chatWithOllama(CHAT_INPUT)).rejects.toMatchObject({
      code: 'provider',
    })
  })

  it('classifies aborted requests as timeouts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      })
    )
    vi.useFakeTimers()

    const request = expect(chatWithOllama(CHAT_INPUT)).rejects.toMatchObject({
      code: 'timeout',
    })
    await vi.advanceTimersByTimeAsync(120_000)

    await request
    vi.useRealTimers()
  })

  it('returns a clean config error when the base URL is missing', async () => {
    vi.stubEnv('OLLAMA_GPU_BASE_URL', '')

    await expect(chatWithOllama(CHAT_INPUT)).rejects.toEqual(
      new OllamaClientError('config', 'Ollama server is not configured')
    )
  })
})

describe('getOllamaModels', () => {
  it('returns available model names', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          models: [
            { name: 'qwen2.5:7b-instruct-q4_K_M' },
            { model: 'secondary' },
          ],
        })
      )
    )

    await expect(getOllamaModels()).resolves.toEqual([
      'qwen2.5:7b-instruct-q4_K_M',
      'secondary',
    ])
  })
})
