import { beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000'
const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'
const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import { getScanResults } from '@/lib/intake/results/repository'

const validResult = {
  project: {
    id: PROJECT_ID,
    owner: 'owner',
    repository: 'repository',
    canonicalUrl: 'https://github.com/owner/repository',
    defaultBranch: 'main',
  },
  scan: {
    id: SCAN_ID,
    projectId: PROJECT_ID,
    requestedRef: null,
    resolvedRef: 'main',
    sourceCommitSha: 'a'.repeat(40),
    status: 'completed',
    statistics: { filesDiscovered: 1 },
    warnings: [],
    safeError: null,
    createdAt: '2026-06-12T12:00:00.000Z',
    startedAt: '2026-06-12T12:01:00.000Z',
    completedAt: '2026-06-12T12:02:00.000Z',
    updatedAt: '2026-06-12T12:02:00.000Z',
  },
  inventoryPreview: [
    {
      relativePath: 'src/index.ts',
      language: 'TypeScript',
      category: 'source',
      sizeBytes: 100,
      isText: true,
    },
  ],
}

beforeEach(() => {
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockResolvedValue({ data: validResult, error: null })
})

describe('getScanResults', () => {
  it('loads the bounded metadata-only read model through the RPC', async () => {
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).resolves.toEqual(validResult)
    expect(mocks.rpc).toHaveBeenCalledWith('get_scan_results', {
      p_project_id: PROJECT_ID,
      p_scan_id: SCAN_ID,
      p_preview_limit: 50,
    })
    expect(JSON.stringify(await getScanResults(PROJECT_ID, SCAN_ID))).not.toContain(
      'contentHash'
    )
  })

  it('returns null for a missing project/scan pair', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).resolves.toBeNull()
  })

  it('rejects malformed and over-limit inventory responses', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...validResult, inventoryPreview: Array(51).fill(validResult.inventoryPreview[0]) },
      error: null,
    })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })

  it('returns a safe persistence failure', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'database secret' } })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).rejects.toMatchObject({
      code: 'database',
      message: 'Scan results are unavailable.',
    })
  })
})
