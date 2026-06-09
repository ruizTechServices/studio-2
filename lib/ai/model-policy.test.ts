import { describe, expect, it } from 'vitest'

import {
  MAX_MESSAGE_CONTENT_LENGTH,
  validateChatRequest,
} from '@/lib/ai/model-policy'

function validContext() {
  return {
    systemPrompt: 'You are a codebase intelligence assistant.',
    summary: '',
    recentMessages: [{ role: 'user', content: 'Explain this repository.' }],
    relevantContext: [],
  }
}

describe('validateChatRequest', () => {
  it('applies centralized model defaults to structured context', () => {
    const result = validateChatRequest({ context: validContext() })

    expect(result).toMatchObject({
      ok: true,
      value: {
        context: validContext(),
        model: 'qwen2.5:7b-instruct-q4_K_M',
        options: { num_gpu: 2, num_ctx: 4096, num_predict: 256 },
        contextConfig: {
          numCtx: 4096,
          numPredict: 256,
          reservedResponseTokens: 256,
          chatTimeoutMs: 120_000,
        },
      },
    })
  })

  it.each([
    ['missing context', {}],
    ['missing system prompt', { context: { ...validContext(), systemPrompt: '' } }],
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
          recentMessages: [{ role: 'user', content: ' ' }],
        },
      },
    ],
    [
      'content over the limit',
      {
        context: {
          ...validContext(),
          recentMessages: [
            { role: 'user', content: 'x'.repeat(MAX_MESSAGE_CONTENT_LENGTH + 1) },
          ],
        },
      },
    ],
    [
      'invalid relevant context',
      { context: { ...validContext(), relevantContext: [''] } },
    ],
    [
      'disallowed model',
      { context: validContext(), model: 'other-model' },
    ],
    [
      'unsafe option',
      { context: validContext(), options: { num_gpu: 99 } },
    ],
  ])('rejects %s', (_case, payload) => {
    expect(validateChatRequest(payload).ok).toBe(false)
  })

  it('allows bounded user options while forcing num_gpu', () => {
    const result = validateChatRequest({
      context: validContext(),
      options: { num_ctx: 2048, num_predict: 256 },
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        options: { num_gpu: 2, num_ctx: 2048, num_predict: 256 },
        contextConfig: { numCtx: 2048, numPredict: 256 },
      },
    })
  })

  it('rejects required prompt context that would consume the output reserve', () => {
    const result = validateChatRequest({
      context: {
        ...validContext(),
        systemPrompt: 'x'.repeat(8_000),
        currentMessage: { role: 'user', content: 'y'.repeat(20_000) },
      },
    })

    expect(result).toEqual({
      ok: false,
      reason: 'Required conversation context is too large',
    })
  })
})
