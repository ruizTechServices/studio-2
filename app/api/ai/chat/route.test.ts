import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  chatWithOllama: vi.fn(),
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/ai/ollama-client', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/ai/ollama-client')>()

  return { ...original, chatWithOllama: mocks.chatWithOllama }
})

vi.mock('@/lib/logger/server', () => ({
  logError: mocks.logError,
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}))

import { POST } from '@/app/api/ai/chat/route'
import { OllamaClientError } from '@/lib/ai/ollama-client'

function validContext() {
  return {
    systemPrompt: 'You are the studio assistant.',
    summary: 'The user is implementing local chat.',
    recentMessages: [
      { role: 'assistant', content: 'What should we improve next?' },
    ],
    relevantContext: ['The app uses Next.js App Router.'],
    currentMessage: { role: 'user', content: 'Explain this repo.' },
  }
}

function createRequest(payload: unknown): Request {
  return new Request('http://localhost/api/ai/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  mocks.logError.mockResolvedValue(undefined)
  mocks.logInfo.mockResolvedValue(undefined)
  mocks.logWarn.mockResolvedValue(undefined)
  mocks.chatWithOllama.mockResolvedValue({
    model: 'qwen2.5:7b-instruct-q4_K_M',
    message: { role: 'assistant', content: 'A concise response.' },
    prompt_eval_count: 80,
    eval_count: 4,
    done: true,
  })
})

describe('POST /api/ai/chat', () => {
  it('compiles structured context and forwards a stateless request', async () => {
    const response = await POST(createRequest({ context: validContext() }))

    expect(response.status).toBe(200)
    expect(mocks.chatWithOllama).toHaveBeenCalledWith({
      messages: [
        { role: 'system', content: 'You are the studio assistant.' },
        {
          role: 'system',
          content:
            'Conversation summary:\nThe user is implementing local chat.',
        },
        {
          role: 'system',
          content:
            'Relevant project context:\nThe app uses Next.js App Router.',
        },
        {
          role: 'assistant',
          content: 'What should we improve next?',
        },
        { role: 'user', content: 'Explain this repo.' },
      ],
      model: 'qwen2.5:7b-instruct-q4_K_M',
      options: { num_gpu: 2, num_ctx: 4096, num_predict: 256 },
      timeoutMs: 120_000,
    })
    expect(await response.json()).toMatchObject({
      ok: true,
      message: { role: 'assistant', content: 'A concise response.' },
      usage: { prompt_tokens: 80, completion_tokens: 4 },
      context: {
        max_input_tokens: 3840,
        included_recent_messages: 1,
        included_relevant_context_items: 1,
      },
    })
    expect(JSON.stringify(mocks.logInfo.mock.calls)).not.toContain(
      'Explain this repo.'
    )
  })

  it('does not retain context between requests', async () => {
    await POST(createRequest({ context: validContext() }))
    await POST(
      createRequest({
        context: {
          ...validContext(),
          summary: '',
          recentMessages: [],
          relevantContext: [],
          currentMessage: { role: 'user', content: 'Second request' },
        },
      })
    )

    expect(mocks.chatWithOllama).toHaveBeenLastCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'You are the studio assistant.' },
          { role: 'user', content: 'Second request' },
        ],
      })
    )
  })

  it.each([
    ['missing context', {}],
    [
      'invalid role',
      {
        context: {
          ...validContext(),
          recentMessages: [{ role: 'tool', content: 'hello' }],
        },
      },
    ],
    [
      'empty content',
      {
        context: {
          ...validContext(),
          currentMessage: { role: 'user', content: '' },
        },
      },
    ],
    ['disallowed model', { context: validContext(), model: 'disallowed' }],
  ])('returns 400 for %s', async (_case, payload) => {
    const response = await POST(createRequest(payload))

    expect(response.status).toBe(400)
    expect(mocks.chatWithOllama).not.toHaveBeenCalled()
  })

  it.each([
    ['config', 500],
    ['provider', 502],
    ['timeout', 504],
  ] as const)('maps %s errors to status %s', async (code, status) => {
    mocks.chatWithOllama.mockRejectedValue(
      new OllamaClientError(code, 'private detail')
    )

    const response = await POST(createRequest({ context: validContext() }))
    const body = await response.json()

    expect(response.status).toBe(status)
    expect(body.error).not.toContain('private detail')

    if (code === 'timeout') {
      expect(body.error).toBe(
        'AI response timed out. Ask for a shorter reply and try again.'
      )
    }
  })
})
