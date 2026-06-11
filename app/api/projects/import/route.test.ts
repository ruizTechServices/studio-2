import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000'
const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'

const mocks = vi.hoisted(() => ({
  createQueuedScan: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/intake/repository', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/intake/repository')>()

  return { ...original, createQueuedScan: mocks.createQueuedScan }
})

vi.mock('@/lib/logger/server', () => ({
  logInfo: mocks.logInfo,
  logWarn: mocks.logWarn,
}))

import { POST } from '@/app/api/projects/import/route'

function request(body: string, contentType = 'application/json'): Request {
  return new Request('http://localhost/api/projects/import', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
  })
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('PROJECT_INTAKE_ENABLED', 'true')
  mocks.createQueuedScan.mockResolvedValue({
    projectId: PROJECT_ID,
    scanId: SCAN_ID,
    status: 'queued',
  })
  mocks.logInfo.mockResolvedValue(undefined)
  mocks.logWarn.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/projects/import', () => {
  it('returns 404 before persistence when intake is disabled', async () => {
    vi.stubEnv('PROJECT_INTAKE_ENABLED', 'false')

    const response = await POST(request('{}'))

    expect(response.status).toBe(404)
    expect(mocks.createQueuedScan).not.toHaveBeenCalled()
  })

  it('returns 404 in production even when enabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const response = await POST(request('{}'))

    expect(response.status).toBe(404)
    expect(mocks.createQueuedScan).not.toHaveBeenCalled()
  })

  it('returns actionable validation errors', async () => {
    const response = await POST(
      request(JSON.stringify({ repositoryUrl: 'https://example.com/repo' }))
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Use the exact format https://github.com/owner/repository.',
      field: 'repositoryUrl',
    })
  })

  it('requires JSON', async () => {
    const response = await POST(request('{}', 'text/plain'))

    expect(response.status).toBe(415)
  })

  it('creates a queued scan and returns identifiers', async () => {
    const response = await POST(
      request(
        JSON.stringify({
          repositoryUrl: 'https://github.com/ruizTechServices/studio-2',
          ref: 'app-shell',
        })
      )
    )

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      projectId: PROJECT_ID,
      scanId: SCAN_ID,
      status: 'queued',
    })
    expect(mocks.createQueuedScan).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'ruiztechservices',
        repository: 'studio-2',
        ref: 'app-shell',
      }),
      expect.objectContaining({ archiveEntriesMax: 20_000 })
    )
  })

  it('returns a safe persistence failure', async () => {
    mocks.createQueuedScan.mockRejectedValue(
      new Error('SUPABASE_SERVICE_ROLE_KEY=secret')
    )

    const response = await POST(
      request(
        JSON.stringify({
          repositoryUrl: 'https://github.com/owner/repository',
        })
      )
    )

    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('secret')
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.objectContaining({ context: { code: 'unexpected' } })
    )
  })
})
