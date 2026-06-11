import { describe, expect, it } from 'vitest'

import type { ConversationContext } from '@/lib/ai/chat-contract'
import { buildChatContext } from '@/lib/ai/context-builder'
import type { ModelContextConfig } from '@/lib/ai/model-config'

const CONFIG: ModelContextConfig = {
  numCtx: 300,
  numPredict: 50,
  reservedResponseTokens: 50,
  maxRelevantContextItems: 3,
  maxSummaryTokens: 50,
  maxRecentMessageTokens: 100,
}

function context(
  overrides: Partial<ConversationContext> = {}
): ConversationContext {
  return {
    systemPrompt: 'Permanent system prompt',
    summary: '',
    recentMessages: [],
    relevantContext: [],
    currentMessage: { role: 'user', content: 'Current question' },
    ...overrides,
  }
}

describe('buildChatContext', () => {
  it('always includes the permanent system prompt first and current message last', () => {
    const result = buildChatContext(context(), CONFIG)

    expect(result.messages[0]).toEqual({
      role: 'system',
      content: 'Permanent system prompt',
    })
    expect(result.messages.at(-1)).toEqual({
      role: 'user',
      content: 'Current question',
    })
  })

  it('includes summary and relevant project context when budget allows', () => {
    const result = buildChatContext(
      context({
        summary: 'User prefers concise implementation notes.',
        relevantContext: ['app/api/ai/chat/route.ts handles chat requests.'],
      }),
      CONFIG
    )

    expect(result.messages.map((message) => message.content)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Conversation summary:'),
        expect.stringContaining('Relevant project context:'),
      ])
    )
    expect(result.includedRelevantContextItems).toBe(1)
  })

  it('prioritizes newest recent messages by token budget instead of count', () => {
    const result = buildChatContext(
      context({
        recentMessages: [
          { role: 'user', content: `old-${'x'.repeat(500)}` },
          { role: 'assistant', content: 'new answer' },
          { role: 'user', content: 'new question' },
        ],
      }),
      CONFIG
    )
    const contents = result.messages.map((message) => message.content)

    expect(contents).not.toContain(expect.stringContaining('old-'))
    expect(contents).toContain('new answer')
    expect(contents).toContain('new question')
  })

  it('can include more than five short recent messages', () => {
    const recentMessages = Array.from({ length: 10 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `m${index}`,
    }))
    const result = buildChatContext(context({ recentMessages }), CONFIG)

    expect(result.includedRecentMessages).toBe(10)
  })

  it('respects the reserved output token budget', () => {
    const result = buildChatContext(
      context({
        recentMessages: Array.from({ length: 20 }, (_, index) => ({
          role: 'user' as const,
          content: `message-${index}-${'x'.repeat(100)}`,
        })),
      }),
      CONFIG
    )

    expect(result.maxInputTokens).toBe(250)
    expect(result.estimatedInputTokens).toBeLessThanOrEqual(250)
  })
})
