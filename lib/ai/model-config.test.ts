import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_MODEL_CONTEXT_CONFIG,
  getModelContextConfig,
} from '@/lib/ai/model-config'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getModelContextConfig', () => {
  it('uses centralized defaults', () => {
    expect(getModelContextConfig()).toEqual(DEFAULT_MODEL_CONTEXT_CONFIG)
  })

  it('supports server environment overrides', () => {
    vi.stubEnv('OLLAMA_NUM_CTX', '8192')
    vi.stubEnv('OLLAMA_NUM_PREDICT', '256')
    vi.stubEnv('OLLAMA_RESERVED_RESPONSE_TOKENS', '768')
    vi.stubEnv('OLLAMA_CHAT_TIMEOUT_MS', '180000')

    expect(getModelContextConfig()).toMatchObject({
      numCtx: 8192,
      numPredict: 256,
      reservedResponseTokens: 768,
      chatTimeoutMs: 180_000,
    })
  })
})
