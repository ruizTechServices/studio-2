import {
  RETRIEVAL_LIMITS,
  type RetrievalErrorCode,
  type ShelfAssetRetrievalPointer,
} from '@/lib/shelves/retrieval/contracts'
import { isValidRetrievalPointer } from '@/lib/shelves/retrieval/validation'

const RAW_HOST = 'raw.githubusercontent.com'

export class SourceRetrievalError extends Error {
  constructor(
    readonly code: RetrievalErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'SourceRetrievalError'
  }
}

export function buildRawSourceUrl(pointer: ShelfAssetRetrievalPointer): string {
  const encodedPath = pointer.relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `https://${RAW_HOST}/${pointer.sourceOwner}/${pointer.sourceRepository}/${pointer.sourceCommitSha}/${encodedPath}`
}

/**
 * Fetches one file at the pointer's pinned commit into bounded memory.
 * Rejects redirects off the raw host, oversized files (declared or streamed),
 * and binary contents. The timeout covers headers and body streaming. The
 * returned text lives only for the duration of the request — callers must
 * never persist or log it.
 */
export async function fetchPinnedSourceFile(
  pointer: ShelfAssetRetrievalPointer,
  dependencies: {
    readonly fetcher?: typeof fetch
    readonly maxFileBytes?: number
    readonly timeoutMs?: number
  } = {}
): Promise<string> {
  if (!isValidRetrievalPointer(pointer)) {
    throw new SourceRetrievalError('not_found', 'The shelf asset pointer is invalid.')
  }

  const fetcher = dependencies.fetcher ?? fetch
  const maxFileBytes = dependencies.maxFileBytes ?? RETRIEVAL_LIMITS.maxFileBytes
  const timeoutMs = dependencies.timeoutMs ?? RETRIEVAL_LIMITS.requestTimeoutMs
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    let response: Response
    try {
      response = await fetcher(buildRawSourceUrl(pointer), {
        redirect: 'error',
        signal: controller.signal,
        headers: { 'user-agent': 'studio-2-shelf-retrieval' },
      })
    } catch {
      if (controller.signal.aborted) {
        throw new SourceRetrievalError('timeout', 'Source retrieval timed out.')
      }
      throw new SourceRetrievalError(
        'github_unavailable',
        'GitHub is temporarily unavailable.'
      )
    }

    if (response.status === 403 || response.status === 429) {
      await response.body?.cancel()
      throw new SourceRetrievalError(
        'github_rate_limited',
        'GitHub request limits were reached.'
      )
    }
    if (response.status >= 500) {
      await response.body?.cancel()
      throw new SourceRetrievalError(
        'github_unavailable',
        'GitHub is temporarily unavailable.'
      )
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel()
      throw new SourceRetrievalError(
        'not_found',
        'The pinned source file is unavailable.'
      )
    }

    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (Number.isFinite(declaredLength) && declaredLength > maxFileBytes) {
      await response.body.cancel()
      throw new SourceRetrievalError(
        'file_too_large',
        'The pinned source file exceeds the preview size limit.'
      )
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let bytes = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          bytes += value.byteLength
          if (bytes > maxFileBytes) {
            await reader.cancel()
            throw new SourceRetrievalError(
              'file_too_large',
              'The pinned source file exceeds the preview size limit.'
            )
          }
          chunks.push(value)
        }
      }
    } catch (error) {
      if (error instanceof SourceRetrievalError) throw error
      if (controller.signal.aborted) {
        throw new SourceRetrievalError('timeout', 'Source retrieval timed out.')
      }
      throw new SourceRetrievalError(
        'github_unavailable',
        'GitHub is temporarily unavailable.'
      )
    }

    const buffer = new Uint8Array(bytes)
    let offset = 0
    for (const chunk of chunks) {
      buffer.set(chunk, offset)
      offset += chunk.byteLength
    }
    if (buffer.includes(0)) {
      throw new SourceRetrievalError(
        'binary_file',
        'The pinned source file is not previewable text.'
      )
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
  } finally {
    clearTimeout(timer)
  }
}
