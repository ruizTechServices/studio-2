import { isProjectIntakeEnabled } from '@/lib/intake/policy'
import { logInfo, logWarn } from '@/lib/logger/server'
import type { ShelfApiError, ShelfField } from '@/lib/shelves/contracts'
import {
  promoteReusableAssetToShelf,
  ShelfPersistenceError,
} from '@/lib/shelves/repository'
import { validatePromoteShelfAssetRequest } from '@/lib/shelves/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8_192

function shelfError(error: string, status: number, field?: ShelfField): Response {
  return Response.json(
    { error, ...(field ? { field } : {}) } satisfies ShelfApiError,
    { status }
  )
}

export async function POST(request: Request): Promise<Response> {
  if (!isProjectIntakeEnabled()) {
    return shelfError('Not found', 404)
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return shelfError('Request body must be JSON.', 415)
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return shelfError('Request body is too large.', 413)
  }

  let rawBody: string
  try {
    rawBody = await request.text()
  } catch {
    return shelfError('Unable to read request body.', 400)
  }
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return shelfError('Request body is too large.', 413)
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return shelfError('Request body must contain valid JSON.', 400)
  }

  const validation = validatePromoteShelfAssetRequest(payload)
  if (!validation.ok) {
    return shelfError(validation.error, 400, validation.field)
  }

  try {
    const asset = await promoteReusableAssetToShelf(validation.value)
    if (asset === null) {
      return shelfError(
        'The candidate was not found on a completed scan.',
        404
      )
    }

    await logInfo({
      message: 'Reusable asset promoted to shelf',
      route: '/api/shelves/promote',
      context: {
        assetId: asset.id,
        shelf: asset.shelf,
        version: asset.version,
        timesPromoted: asset.timesPromoted,
      },
    })

    return Response.json(asset, { status: 201 })
  } catch (error) {
    const code =
      error instanceof ShelfPersistenceError ? error.code : 'unexpected'
    await logWarn({
      message: 'Shelf promotion failed',
      route: '/api/shelves/promote',
      context: { code },
    })
    return shelfError('The shelf library is unavailable.', 503)
  }
}
