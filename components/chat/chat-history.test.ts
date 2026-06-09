import { describe, expect, it } from 'vitest'

import { getVisibleChatMessages } from './chat-history'

describe('getVisibleChatMessages', () => {
  it('limits only UI history to the latest five messages', () => {
    const messages = Array.from({ length: 8 }, (_, index) => ({
      role: 'user' as const,
      content: `message-${index}`,
    }))

    expect(getVisibleChatMessages(messages).map((message) => message.content))
      .toEqual([
        'message-3',
        'message-4',
        'message-5',
        'message-6',
        'message-7',
      ])
  })
})
