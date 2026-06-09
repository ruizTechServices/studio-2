import { afterEach, describe, expect, it, vi } from 'vitest'

import { sendChat } from './chat-client'

const REQUEST = {
  context: {
    systemPrompt: 'You are the studio assistant.',
    summary: '',
    recentMessages: [],
    relevantContext: [],
    currentMessage: { role: 'user' as const, content: 'Question' },
  },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sendChat', () => {
  it('posts supplied structured stateless context and returns assistant content', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        message: { role: 'assistant', content: '  Response text.  ' },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(sendChat('/api/ai/chat', REQUEST)).resolves.toEqual({
      content: 'Response text.',
      doneReason: null,
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/ai/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(REQUEST),
    })
  })

  it('returns the provider done reason for real truncation indicators', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          ok: true,
          message: { role: 'assistant', content: 'Partial response' },
          done_reason: 'length',
        })
      )
    )

    await expect(sendChat('/api/ai/chat', REQUEST)).resolves.toEqual({
      content: 'Partial response',
      doneReason: 'length',
    })
  })

  it('returns the sanitized API error to the card', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          { ok: false, error: 'AI service is unavailable' },
          { status: 502 }
        )
      )
    )

    await expect(sendChat('/api/ai/chat', REQUEST)).rejects.toThrow(
      'AI service is unavailable'
    )
  })
})
