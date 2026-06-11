import { describe, expect, it } from 'vitest'

import {
  estimateMessageTokens,
  estimateTextTokens,
  getMaxInputTokens,
  truncateTextToLastTokens,
  truncateTextToTokens,
} from '@/lib/ai/token-budget'

describe('token budget utilities', () => {
  it('estimates text and message tokens with isolated rough heuristics', () => {
    expect(estimateTextTokens('12345678')).toBe(2)
    expect(
      estimateMessageTokens({ role: 'user', content: '12345678' })
    ).toBe(6)
  })

  it('reserves output tokens from the context window', () => {
    expect(getMaxInputTokens(4096, 512)).toBe(3584)
  })

  it('truncates text to an estimated token limit', () => {
    expect(truncateTextToTokens('x'.repeat(100), 5).length).toBeLessThan(100)
    expect(truncateTextToLastTokens(`old-${'x'.repeat(100)}-new`, 5)).toContain(
      'new'
    )
  })
})
