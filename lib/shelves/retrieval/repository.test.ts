import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import { getShelfAssetRetrievalPointer } from '@/lib/shelves/retrieval/repository'

const ASSET_ID = '123e4567-e89b-42d3-a456-426614174010'

const validPointer = {
  id: ASSET_ID,
  sourceOwner: 'owner',
  sourceRepository: 'repository',
  sourceCommitSha: 'a'.repeat(40),
  relativePath: 'components/brand/brand-logo.tsx',
  lineStart: 9,
  lineEnd: 53,
  symbolName: 'BrandLogo',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('getShelfAssetRetrievalPointer', () => {
  it('returns the validated pointer', async () => {
    mocks.rpc.mockResolvedValue({ data: validPointer, error: null })
    await expect(getShelfAssetRetrievalPointer(ASSET_ID)).resolves.toEqual(
      validPointer
    )
    expect(mocks.rpc).toHaveBeenCalledWith('get_shelf_asset_retrieval_pointer', {
      p_asset_id: ASSET_ID,
    })
  })

  it('returns null when the asset does not exist', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })
    await expect(getShelfAssetRetrievalPointer(ASSET_ID)).resolves.toBeNull()
  })

  it('throws a config error when the client cannot be created', async () => {
    mocks.createServiceRoleClient.mockImplementation(() => {
      throw new Error('missing env')
    })
    await expect(getShelfAssetRetrievalPointer(ASSET_ID)).rejects.toMatchObject({
      name: 'ShelfPersistenceError',
      code: 'config',
    })
  })

  it('throws a database error when the rpc fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(getShelfAssetRetrievalPointer(ASSET_ID)).rejects.toMatchObject({
      code: 'database',
    })
  })

  it('rejects malformed pointers instead of trusting them', async () => {
    mocks.rpc.mockResolvedValue({
      data: { ...validPointer, relativePath: '../../etc/passwd' },
      error: null,
    })
    await expect(getShelfAssetRetrievalPointer(ASSET_ID)).rejects.toMatchObject({
      code: 'invalid_response',
    })
  })
})
