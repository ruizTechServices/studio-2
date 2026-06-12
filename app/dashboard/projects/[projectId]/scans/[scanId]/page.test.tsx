import { beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000'
const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'
const mocks = vi.hoisted(() => ({
  getScanResults: vi.fn(),
  logWarn: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found')
  }),
}))

vi.mock('@/lib/intake/results/repository', () => ({
  getScanResults: mocks.getScanResults,
  ScanResultsPersistenceError: class extends Error {
    code = 'database'
  },
}))
vi.mock('@/lib/logger/server', () => ({ logWarn: mocks.logWarn }))
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }))

import ScanResultsPage from '@/app/dashboard/projects/[projectId]/scans/[scanId]/page'

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('PROJECT_INTAKE_ENABLED', 'true')
  mocks.logWarn.mockResolvedValue(undefined)
})

describe('ScanResultsPage', () => {
  it('renders the results view for a valid project/scan pair', async () => {
    mocks.getScanResults.mockResolvedValue({
      project: { id: PROJECT_ID },
      scan: { id: SCAN_ID },
      inventoryPreview: [],
    })
    const page = await ScanResultsPage({
      params: Promise.resolve({ projectId: PROJECT_ID, scanId: SCAN_ID }),
    })
    expect(page.type.name).toBe('ScanResultsView')
  })

  it('uses safe not-found handling for invalid or missing scans', async () => {
    await expect(
      ScanResultsPage({ params: Promise.resolve({ projectId: 'bad', scanId: SCAN_ID }) })
    ).rejects.toThrow('not-found')
    mocks.getScanResults.mockResolvedValue(null)
    await expect(
      ScanResultsPage({ params: Promise.resolve({ projectId: PROJECT_ID, scanId: SCAN_ID }) })
    ).rejects.toThrow('not-found')
  })

  it('renders a safe unavailable state for persistence failures', async () => {
    mocks.getScanResults.mockRejectedValue(new Error('database password'))
    const page = await ScanResultsPage({
      params: Promise.resolve({ projectId: PROJECT_ID, scanId: SCAN_ID }),
    })
    expect(page.type.name).toBe('ScanResultsUnavailable')
    expect(mocks.logWarn).toHaveBeenCalled()
  })
})
