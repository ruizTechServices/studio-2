import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const USER_ID = '123e4567-e89b-42d3-a456-426614174000'

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  createClient: vi.fn(),
  getClaims: vi.fn(),
  pendingAfter: [] as Array<Promise<unknown>>,
  writeLog: vi.fn(),
}))

vi.mock('next/server', () => ({
  after: mocks.after,
}))

vi.mock('@/lib/logger/server', () => ({
  writeLog: mocks.writeLog,
}))

vi.mock('@/lib/server', () => ({
  createClient: mocks.createClient,
}))

import { POST } from '@/app/api/log/route'

function createRequest(
  body: string,
  headers: Record<string, string> = {}
): Request {
  return new Request('http://localhost/api/log', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body,
  })
}

function validPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    level: 'info',
    message: 'Client event',
    context: {},
    ...overrides,
  })
}

async function runAfterCallbacks(): Promise<void> {
  await Promise.all(mocks.pendingAfter)
}

beforeEach(() => {
  mocks.pendingAfter.length = 0
  mocks.after.mockImplementation((callback: () => unknown) => {
    mocks.pendingAfter.push(Promise.resolve().then(callback))
  })
  mocks.getClaims.mockResolvedValue({
    data: { claims: null },
    error: null,
  })
  mocks.createClient.mockResolvedValue({
    auth: { getClaims: mocks.getClaims },
  })
  mocks.writeLog.mockResolvedValue(undefined)
  vi.stubEnv('NODE_ENV', 'test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/log valid payloads', () => {
  it('returns ok and delegates with client-forced source and null user', async () => {
    const response = await POST(
      createRequest(validPayload({ source: 'server', user_id: USER_ID }))
    )
    await runAfterCallbacks()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.writeLog).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'client',
        user_id: null,
      })
    )
  })

  it('attaches a valid authenticated user ID', async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: USER_ID } },
      error: null,
    })

    await POST(createRequest(validPayload()))
    await runAfterCallbacks()

    expect(mocks.writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID })
    )
  })

  it('uses null for an invalid authenticated user ID', async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: 'invalid-user' } },
      error: null,
    })

    await POST(createRequest(validPayload()))
    await runAfterCallbacks()

    expect(mocks.writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null })
    )
  })

  it('infers a route path from the referer header', async () => {
    await POST(
      createRequest(validPayload(), {
        referer: 'https://studio.example/projects/123?token=secret',
      })
    )
    await runAfterCallbacks()

    expect(mocks.writeLog).toHaveBeenCalledWith(
      expect.objectContaining({ route: '/projects/123' })
    )
  })

  it('suppresses production debug logs without scheduling a write', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const response = await POST(
      createRequest(validPayload({ level: 'debug' }))
    )

    expect(await response.json()).toEqual({ ok: true })
    expect(mocks.after).not.toHaveBeenCalled()
    expect(mocks.writeLog).not.toHaveBeenCalled()
  })

  it('does not leak or propagate write errors from after callbacks', async () => {
    mocks.writeLog.mockRejectedValue(new Error('internal database error'))

    const response = await POST(createRequest(validPayload()))
    await expect(runAfterCallbacks()).resolves.toBeUndefined()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})

describe('POST /api/log invalid payloads', () => {
  it('returns 415 for missing or wrong content type', async () => {
    const missing = new Request('http://localhost/api/log', {
      method: 'POST',
      body: validPayload(),
    })
    const wrong = createRequest(validPayload(), {
      'content-type': 'text/plain',
    })

    expect((await POST(missing)).status).toBe(415)
    expect((await POST(wrong)).status).toBe(415)
  })

  it('returns 413 for a declared body length over the limit', async () => {
    const response = await POST(
      createRequest(validPayload(), { 'content-length': '32769' })
    )

    expect(response.status).toBe(413)
  })

  it('returns 413 for an actual body over the limit', async () => {
    const response = await POST(
      createRequest(validPayload({ message: 'x'.repeat(33_000) }))
    )

    expect(response.status).toBe(413)
  })

  it.each([
    ['malformed JSON', '{bad-json'],
    ['non-object JSON', '[]'],
    ['invalid level', validPayload({ level: 'trace' })],
    ['invalid context', validPayload({ context: [] })],
  ])('returns 400 for %s', async (_case, body) => {
    const response = await POST(createRequest(body))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      ok: false,
      error: 'Invalid log payload',
    })
    expect(mocks.writeLog).not.toHaveBeenCalled()
  })
})
