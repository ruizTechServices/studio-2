import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000'
const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'

const mocks = vi.hoisted(() => ({
  getScanStatus: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/intake/repository', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/lib/intake/repository')>()

  return { ...original, getScanStatus: mocks.getScanStatus }
})

vi.mock('@/lib/logger/server', () => ({
  logWarn: mocks.logWarn,
}))

import { GET } from '@/app/api/scans/[scanId]/route'

function context(scanId: string) {
  return { params: Promise.resolve({ scanId }) }
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('PROJECT_INTAKE_ENABLED', 'true')
  mocks.getScanStatus.mockResolvedValue({
    scanId: SCAN_ID,
    projectId: PROJECT_ID,
    status: 'queued',
    statistics: {},
    warnings: [],
    safeError: null,
    summaryStatus: 'not_started',
  })
  mocks.logWarn.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/scans/[scanId]', () => {
  it('returns 404 before persistence when intake is disabled', async () => {
    vi.stubEnv('PROJECT_INTAKE_ENABLED', 'false')

    const response = await GET(
      new Request(`http://localhost/api/scans/${SCAN_ID}`),
      context(SCAN_ID)
    )

    expect(response.status).toBe(404)
    expect(mocks.getScanStatus).not.toHaveBeenCalled()
  })

  it('rejects invalid scan IDs', async () => {
    const response = await GET(
      new Request('http://localhost/api/scans/not-a-uuid'),
      context('not-a-uuid')
    )

    expect(response.status).toBe(400)
  })

  it('returns 404 for an unknown scan', async () => {
    mocks.getScanStatus.mockResolvedValue(null)

    const response = await GET(
      new Request(`http://localhost/api/scans/${SCAN_ID}`),
      context(SCAN_ID)
    )

    expect(response.status).toBe(404)
  })

  it('returns a safe scan status shape', async () => {
    const response = await GET(
      new Request(`http://localhost/api/scans/${SCAN_ID}`),
      context(SCAN_ID)
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      scanId: SCAN_ID,
      projectId: PROJECT_ID,
      status: 'queued',
      statistics: {},
      warnings: [],
      safeError: null,
      summaryStatus: 'not_started',
    })
  })

  it('returns a safe persistence failure', async () => {
    mocks.getScanStatus.mockRejectedValue(new Error('database password'))

    const response = await GET(
      new Request(`http://localhost/api/scans/${SCAN_ID}`),
      context(SCAN_ID)
    )

    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('password')
  })
})
