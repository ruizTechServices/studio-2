import { createServiceRoleClient } from '@/lib/server'
import type { ShelfAssetRetrievalPointer } from '@/lib/shelves/retrieval/contracts'
import { isValidRetrievalPointer } from '@/lib/shelves/retrieval/validation'
import { ShelfPersistenceError } from '@/lib/shelves/repository'

/**
 * Reads the provenance pointer for one shelf asset. Returns null when the
 * asset does not exist. The pointer is re-validated before it is trusted.
 */
export async function getShelfAssetRetrievalPointer(
  assetId: string
): Promise<ShelfAssetRetrievalPointer | null> {
  let client
  try {
    client = createServiceRoleClient()
  } catch {
    throw new ShelfPersistenceError('config', 'The shelf library is unavailable.')
  }

  const { data, error } = await client.rpc('get_shelf_asset_retrieval_pointer', {
    p_asset_id: assetId,
  })
  if (error) {
    throw new ShelfPersistenceError('database', 'The shelf library is unavailable.')
  }
  if (data === null) return null
  if (!isValidRetrievalPointer(data)) {
    throw new ShelfPersistenceError(
      'invalid_response',
      'The shelf library returned an invalid response.'
    )
  }
  return data
}
