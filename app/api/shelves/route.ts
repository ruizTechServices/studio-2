import { isProjectIntakeEnabled } from '@/lib/intake/policy'
import { logWarn } from '@/lib/logger/server'
import type { ShelfApiError, ShelfField } from '@/lib/shelves/contracts'
import {
  searchShelfAssets,
  ShelfPersistenceError,
} from '@/lib/shelves/repository'
import { validateShelfSearchQuery } from '@/lib/shelves/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function shelfError(error: string, status: number, field?: ShelfField): Response {
  return Response.json(
    { error, ...(field ? { field } : {}) } satisfies ShelfApiError,
    { status }
  )
}

export async function GET(request: Request): Promise<Response> {
  if (!isProjectIntakeEnabled()) {
    return shelfError('Not found', 404)
  }

  const parameters = new URL(request.url).searchParams
  const validation = validateShelfSearchQuery({
    query: parameters.get('q'),
    shelf: parameters.get('shelf'),
    limit: parameters.get('limit'),
  })
  if (!validation.ok) {
    return shelfError(validation.error, 400, validation.field)
  }

  try {
    const result = await searchShelfAssets(validation.value)
    return Response.json(result)
  } catch (error) {
    const code =
      error instanceof ShelfPersistenceError ? error.code : 'unexpected'
    await logWarn({
      message: 'Shelf search failed',
      route: '/api/shelves',
      context: { code },
    })
    return shelfError('The shelf library is unavailable.', 503)
  }
}
