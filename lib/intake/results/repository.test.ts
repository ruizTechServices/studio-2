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

const validSystemMapFiles = [
  {
    relativePath: 'src/index.ts',
    name: 'index.ts',
    extension: 'ts',
    language: 'TypeScript',
    category: 'source',
    sizeBytes: 100,
    depth: 2,
    isText: true,
  },
]

const validSymbolSummary = {
  total: 1,
  counts: {
    import: 0,
    export: 1,
    function: 0,
    component: 0,
    hook: 0,
    api_handler: 0,
    type: 0,
    constant: 0,
    unknown: 0,
  },
  preview: [{
    relativePath: 'src/index.ts',
    kind: 'export',
    name: 'value',
    exported: true,
    importSource: null,
    lineStart: 1,
    lineEnd: 1,
    confidence: 'high',
    category: 'declaration',
  }],
}

beforeEach(() => {
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
  mocks.rpc.mockImplementation((name: string) => Promise.resolve({
    data: name === 'get_scan_results'
      ? validResult
      : name === 'get_scan_system_map_files'
        ? validSystemMapFiles
        : validSymbolSummary,
    error: null,
  }))
})

describe('getScanResults', () => {
  it('loads the bounded metadata-only read model through the RPC', async () => {
    const results = await getScanResults(PROJECT_ID, SCAN_ID)
    expect(results).toMatchObject(validResult)
    expect(results?.systemMapSeed).toMatchObject({
      scanId: SCAN_ID,
      projectId: PROJECT_ID,
      generatedFrom: 'metadata_only',
      counts: { sourceModules: 1 },
    })
    expect(results?.symbolSummary).toEqual(validSymbolSummary)
    expect(mocks.rpc).toHaveBeenCalledWith('get_scan_results', {
      p_project_id: PROJECT_ID,
      p_scan_id: SCAN_ID,
      p_preview_limit: 50,
    })
    expect(mocks.rpc).toHaveBeenCalledWith('get_scan_system_map_files', {
      p_project_id: PROJECT_ID,
      p_scan_id: SCAN_ID,
    })
    expect(mocks.rpc).toHaveBeenCalledWith('get_scan_symbol_summary', {
      p_project_id: PROJECT_ID,
      p_scan_id: SCAN_ID,
      p_preview_limit: 25,
    })
    expect(JSON.stringify(results)).not.toContain('contentHash')
  })

  it('returns null for a missing project/scan pair', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).resolves.toBeNull()
  })

  it('rejects malformed and over-limit inventory responses', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: { ...validResult, inventoryPreview: Array(51).fill(validResult.inventoryPreview[0]) },
      error: null,
    })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })

  it('returns a safe persistence failure', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'database secret' } })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).rejects.toMatchObject({
      code: 'database',
      message: 'Scan results are unavailable.',
    })
  })

  it('rejects malformed system map metadata safely', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: validResult, error: null })
      .mockResolvedValueOnce({ data: [{ relativePath: 'missing-required-fields' }], error: null })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })

  it('rejects malformed symbol metadata safely', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: validResult, error: null })
      .mockResolvedValueOnce({ data: validSystemMapFiles, error: null })
      .mockResolvedValueOnce({ data: { ...validSymbolSummary, preview: Array(26).fill(validSymbolSummary.preview[0]) }, error: null })
    await expect(getScanResults(PROJECT_ID, SCAN_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })
})
