import { describe, expect, it } from 'vitest'

import {
  compactConversation,
  updateConversationSummary,
} from '@/lib/ai/conversation-summary'

describe('conversation summary utilities', () => {
  it('creates a deterministic summary without provider calls', () => {
    expect(
      updateConversationSummary('', [
        { role: 'user', content: 'Prefer TypeScript strict mode.' },
        { role: 'assistant', content: 'I will preserve strict types.' },
      ])
    ).toContain('User: Prefer TypeScript strict mode.')
  })

  it('moves oldest messages into the rolling summary by token budget', () => {
    const result = compactConversation(
      '',
      [
        { role: 'user', content: 'old '.repeat(100) },
        { role: 'assistant', content: 'new answer' },
        { role: 'user', content: 'new question' },
      ],
      20
    )

    expect(result.summary).toContain('User:')
    expect(result.recentMessages.at(-1)?.content).toBe('new question')
  })

  it('preserves newer summary entries when the summary budget is full', () => {
    const summary = updateConversationSummary(
      'Old decision. '.repeat(100),
      [{ role: 'user', content: 'Newest unresolved question.' }],
      30
    )

    expect(summary).toContain('Newest unresolved question.')
  })
})
