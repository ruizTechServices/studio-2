import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import {
  parseShelfAsset,
  promoteReusableAssetToShelf,
  searchShelfAssets,
  ShelfPersistenceError,
} from '@/lib/shelves/repository'

const validAsset = {
  id: '123e4567-e89b-42d3-a456-426614174010',
  shelf: 'components',
  assetKind: 'ui_component',
  symbolName: 'Button',
  symbolKind: 'component',
  exported: true,
  sourceOwner: 'owner',
  sourceRepository: 'repository',
  sourceCanonicalUrl: 'https://github.com/owner/repository',
  sourceCommitSha: 'a'.repeat(40),
  relativePath: 'components/ui/button.tsx',
  lineStart: 10,
  lineEnd: 42,
  projectId: '123e4567-e89b-42d3-a456-426614174000',
  reuseScore: 92,
  confidence: 'high',
  reasons: ['Exported declaration'],
  tags: ['tailwind'],
  notes: null,
  visibility: 'private',
  version: 1,
  timesPromoted: 1,
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
}

const promoteRequest = {
  scanId: '123e4567-e89b-42d3-a456-426614174001',
  projectId: '123e4567-e89b-42d3-a456-426614174000',
  relativePath: 'components/ui/button.tsx',
  symbolName: 'Button',
  symbolKind: 'component',
  shelf: null,
  tags: [],
  notes: null,
} as const

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('parseShelfAsset', () => {
  it('accepts a fully valid asset', () => {
    expect(parseShelfAsset(validAsset)).toEqual(validAsset)
  })

  it.each([
    ['shelf', 'weapons'],
    ['assetKind', 'malware'],
    ['symbolKind', 'import'],
    ['sourceCommitSha', 'short'],
    ['reuseScore', 101],
    ['confidence', 'certain'],
    ['reasons', []],
    ['tags', [1]],
    ['visibility', 'stolen'],
    ['version', 0],
    ['createdAt', 'yesterday'],
  ])('rejects an invalid %s', (field, value) => {
    expect(parseShelfAsset({ ...validAsset, [field]: value })).toBeNull()
  })
})

describe('promoteReusableAssetToShelf', () => {
  it('returns the parsed asset on success', async () => {
    mocks.rpc.mockResolvedValue({ data: validAsset, error: null })
    await expect(promoteReusableAssetToShelf(promoteRequest)).resolves.toEqual(
      validAsset
    )
    expect(mocks.rpc).toHaveBeenCalledWith('promote_reusable_asset_to_shelf', {
      p_scan_id: promoteRequest.scanId,
      p_project_id: promoteRequest.projectId,
      p_relative_path: promoteRequest.relativePath,
      p_symbol_name: promoteRequest.symbolName,
      p_symbol_kind: promoteRequest.symbolKind,
      p_shelf: null,
      p_tags: [],
      p_notes: null,
    })
  })

  it('returns null when the candidate no longer exists', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await expect(promoteReusableAssetToShelf(promoteRequest)).resolves.toBeNull()
  })

  it('throws a config error when the client cannot be created', async () => {
    mocks.createServiceRoleClient.mockImplementation(() => {
      throw new Error('missing env')
    })
    await expect(promoteReusableAssetToShelf(promoteRequest)).rejects.toMatchObject(
      { name: 'ShelfPersistenceError', code: 'config' }
    )
  })

  it('throws a database error when the rpc fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(promoteReusableAssetToShelf(promoteRequest)).rejects.toMatchObject(
      { name: 'ShelfPersistenceError', code: 'database' }
    )
  })

  it('throws an invalid_response error for malformed rows', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...validAsset, reuseScore: 'high' },
      error: null,
    })
    await expect(promoteReusableAssetToShelf(promoteRequest)).rejects.toThrow(
      ShelfPersistenceError
    )
  })
})

describe('searchShelfAssets', () => {
  const query = { query: 'button', shelf: null, limit: 24 } as const

  it('returns the parsed search result', async () => {
    mocks.rpc.mockResolvedValue({
      data: { total: 1, shelfCounts: { components: 1 }, assets: [validAsset] },
      error: null,
    })
    await expect(searchShelfAssets(query)).resolves.toEqual({
      total: 1,
      shelfCounts: { components: 1 },
      assets: [validAsset],
    })
    expect(mocks.rpc).toHaveBeenCalledWith('search_shelf_assets', {
      p_query: 'button',
      p_shelf: null,
      p_limit: 24,
    })
  })

  it('rejects responses containing unknown shelves', async () => {
    mocks.rpc.mockResolvedValue({
      data: { total: 1, shelfCounts: { weapons: 1 }, assets: [] },
      error: null,
    })
    await expect(searchShelfAssets(query)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })

  it('rejects responses containing malformed assets', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        total: 1,
        shelfCounts: {},
        assets: [{ ...validAsset, sourceCommitSha: null }],
      },
      error: null,
    })
    await expect(searchShelfAssets(query)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })

  it('throws a database error when the rpc fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(searchShelfAssets(query)).rejects.toMatchObject({
      code: 'database',
    })
  })
})
