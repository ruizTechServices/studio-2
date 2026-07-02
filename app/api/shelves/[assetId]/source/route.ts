import { isProjectIntakeEnabled } from '@/lib/intake/policy'
import { logInfo, logWarn } from '@/lib/logger/server'
import type { ShelfApiError } from '@/lib/shelves/contracts'
import { ShelfPersistenceError } from '@/lib/shelves/repository'
import type { ShelfSourcePreview } from '@/lib/shelves/retrieval/contracts'
import {
  buildRawSourceUrl,
  fetchPinnedSourceFile,
  SourceRetrievalError,
} from '@/lib/shelves/retrieval/github-source-client'
import { sliceSourceLines } from '@/lib/shelves/retrieval/line-slicer'
import { getShelfAssetRetrievalPointer } from '@/lib/shelves/retrieval/repository'
import { isValidAssetId } from '@/lib/shelves/retrieval/validation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function shelfError(error: string, status: number): Response {
  return Response.json({ error } satisfies ShelfApiError, { status })
}

/**
 * GET /api/shelves/[assetId]/source — bounded on-demand source preview.
 * Fetches the asset's file at its pinned commit, slices the stored line range
 * in memory, and returns it. Source contents are never persisted or logged.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> }
): Promise<Response> {
  if (!isProjectIntakeEnabled()) {
    return shelfError('Not found', 404)
  }

  const { assetId } = await params
  if (!isValidAssetId(assetId)) {
    return shelfError('A valid shelf asset id is required.', 400)
  }

  let pointer
  try {
    pointer = await getShelfAssetRetrievalPointer(assetId.toLowerCase())
  } catch (error) {
    const code =
      error instanceof ShelfPersistenceError ? error.code : 'unexpected'
    await logWarn({
      message: 'Shelf retrieval pointer lookup failed',
      route: '/api/shelves/[assetId]/source',
      context: { code },
    })
    return shelfError('The shelf library is unavailable.', 503)
  }
  if (pointer === null) {
    return shelfError('The shelf asset was not found.', 404)
  }

  try {
    const text = await fetchPinnedSourceFile(pointer)
    const slice = sliceSourceLines(text, pointer.lineStart, pointer.lineEnd)
    const preview: ShelfSourcePreview = {
      assetId: pointer.id,
      symbolName: pointer.symbolName,
      sourceOwner: pointer.sourceOwner,
      sourceRepository: pointer.sourceRepository,
      sourceCommitSha: pointer.sourceCommitSha,
      relativePath: pointer.relativePath,
      sourceUrl: buildRawSourceUrl(pointer),
      totalLines: slice.totalLines,
      lineStart: slice.lineStart,
      lineEnd: slice.lineEnd,
      truncatedByLineLimit: slice.truncatedByLineLimit,
      lines: slice.lines,
    }

    await logInfo({
      message: 'Shelf source preview served',
      route: '/api/shelves/[assetId]/source',
      context: {
        assetId: pointer.id,
        lineCount: slice.lines.length,
        totalLines: slice.totalLines,
      },
    })

    return Response.json(preview, {
      headers: { 'cache-control': 'no-store' },
    })
  } catch (error) {
    if (error instanceof SourceRetrievalError) {
      await logWarn({
        message: 'Shelf source retrieval failed',
        route: '/api/shelves/[assetId]/source',
        context: { code: error.code, assetId: pointer.id },
      })
      const status =
        error.code === 'not_found' ? 404
        : error.code === 'binary_file' || error.code === 'file_too_large' ? 422
        : error.code === 'timeout' ? 504
        : 502
      return shelfError(error.message, status)
    }
    await logWarn({
      message: 'Shelf source retrieval failed',
      route: '/api/shelves/[assetId]/source',
      context: { code: 'unexpected', assetId: pointer.id },
    })
    return shelfError('Source retrieval is unavailable.', 503)
  }
}
