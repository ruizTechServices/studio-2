import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/logger/client', () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}))

import {
  logChatFailed,
  logChatSubmitted,
  logChatSucceeded,
} from './chat-telemetry'

beforeEach(() => {
  mocks.logInfo.mockResolvedValue(undefined)
  mocks.logWarn.mockResolvedValue(undefined)
})

describe('chat telemetry', () => {
  it('logs safe request and response metadata without message content', () => {
    logChatSubmitted({
      recentMessageCount: 3,
      endpoint: '/api/ai/chat',
    })
    logChatSucceeded({
      recentMessageCount: 3,
      responseLength: 120,
      durationMs: 450,
      endpoint: '/api/ai/chat',
    })

    expect(mocks.logInfo).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(mocks.logInfo.mock.calls)).not.toContain('content')
  })

  it('logs failures as warnings with safe metadata', () => {
    logChatFailed({
      recentMessageCount: 5,
      durationMs: 900,
      endpoint: '/api/ai/chat',
    })

    expect(mocks.logWarn).toHaveBeenCalledWith({
      message: 'Local chat request failed',
      context: {
        recent_message_count: 5,
        duration_ms: 900,
        endpoint: '/api/ai/chat',
      },
    })
  })
})
