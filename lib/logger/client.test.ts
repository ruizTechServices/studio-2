// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ClientLogDetails } from '@/lib/logger/client'
import {
  logAudit,
  logDebug,
  logError,
  logFatal,
  logInfo,
  logWarn,
} from '@/lib/logger/client'

const fetchMock = vi.fn()

function sentPayload(): Record<string, unknown> {
  const options = fetchMock.mock.calls[0][1] as RequestInit
  return JSON.parse(options.body as string) as Record<string, unknown>
}

beforeEach(() => {
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  vi.stubEnv('NODE_ENV', 'test')
  window.history.replaceState({}, '', '/current-project?ignored=true')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('client logger helpers', () => {
  it.each([
    ['debug', logDebug],
    ['info', logInfo],
    ['warn', logWarn],
    ['error', logError],
    ['fatal', logFatal],
    ['audit', logAudit],
  ] as const)('POSTs %s logs with client defaults', async (level, helper) => {
    await helper({ message: `${level} message` })

    expect(fetchMock).toHaveBeenCalledWith('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.any(String),
      credentials: 'same-origin',
      keepalive: true,
    })
    expect(sentPayload()).toMatchObject({
      level,
      message: `${level} message`,
      context: {},
      source: 'client',
      route: '/current-project',
      user_id: null,
    })
  })

  it('preserves and sanitizes a provided route and sensitive context', async () => {
    await logInfo({
      message: 'Opened project',
      route: '/provided?token=secret#details',
      context: { apiKey: 'sensitive' },
    })

    expect(sentPayload()).toMatchObject({
      route: '/provided',
      context: { apiKey: '[REDACTED]' },
    })
  })

  it('skips debug logs in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await logDebug({ message: 'suppressed' })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not throw when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('network unavailable'))

    await expect(logInfo({ message: 'safe failure' })).resolves.toBeUndefined()
  })

  it('does not fetch invalid payloads', async () => {
    const invalidDetails = { message: '' } as ClientLogDetails

    await logInfo(invalidDetails)

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
