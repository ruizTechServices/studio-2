import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getOllamaModels: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/ai/ollama-client', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/ai/ollama-client')>()

  return { ...original, getOllamaModels: mocks.getOllamaModels }
})

vi.mock('@/lib/logger/server', () => ({
  logWarn: mocks.logWarn,
}))

import { GET } from '@/app/api/ai/health/route'
import { OllamaClientError } from '@/lib/ai/ollama-client'

beforeEach(() => {
  mocks.logWarn.mockResolvedValue(undefined)
})

describe('GET /api/ai/health', () => {
  it('returns reachable and available model names', async () => {
    mocks.getOllamaModels.mockResolvedValue([
      'qwen2.5:7b-instruct-q4_K_M',
    ])

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      ok: true,
      reachable: true,
      models: ['qwen2.5:7b-instruct-q4_K_M'],
    })
  })

  it('returns a sanitized failure without infrastructure details', async () => {
    mocks.getOllamaModels.mockRejectedValue(
      new OllamaClientError('provider', 'http://private-host failed')
    )

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(502)
    expect(body).toEqual({
      ok: false,
      reachable: false,
      models: [],
      error: 'AI service is unavailable',
    })
  })
})
