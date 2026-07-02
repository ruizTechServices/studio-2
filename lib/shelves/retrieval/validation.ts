import type { ShelfAssetRetrievalPointer } from '@/lib/shelves/retrieval/contracts'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const COMMIT_SHA = /^[0-9a-f]{40}$/
const GITHUB_OWNER = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/
const GITHUB_REPOSITORY = /^[a-z0-9._-]{1,100}$/
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export function isValidAssetId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

export function isValidCommitSha(value: unknown): value is string {
  return typeof value === 'string' && COMMIT_SHA.test(value)
}

/**
 * Repository-relative paths must already be normalized: forward slashes only,
 * no traversal, no absolute prefixes, no empty segments, no control
 * characters. Anything else is rejected rather than repaired.
 */
export function isValidRepositoryPath(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 512 ||
    value.includes('\\') ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    CONTROL_CHARACTERS.test(value)
  ) {
    return false
  }
  const segments = value.split('/')
  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..'
  )
}

function isValidLineBound(value: unknown): value is number | null {
  return (
    value === null ||
    (Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= 1_000_000)
  )
}

/**
 * Re-validates a retrieval pointer at the trust boundary before any network
 * fetch is attempted, even though the database constrains the same fields.
 */
export function isValidRetrievalPointer(
  value: unknown
): value is ShelfAssetRetrievalPointer {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const pointer = value as Record<string, unknown>
  return (
    isValidAssetId(pointer.id) &&
    typeof pointer.sourceOwner === 'string' &&
    GITHUB_OWNER.test(pointer.sourceOwner) &&
    typeof pointer.sourceRepository === 'string' &&
    GITHUB_REPOSITORY.test(pointer.sourceRepository) &&
    isValidCommitSha(pointer.sourceCommitSha) &&
    isValidRepositoryPath(pointer.relativePath) &&
    isValidLineBound(pointer.lineStart) &&
    isValidLineBound(pointer.lineEnd) &&
    (pointer.lineStart === null) === (pointer.lineEnd === null) &&
    (pointer.lineStart === null ||
      (pointer.lineEnd as number) >= (pointer.lineStart as number)) &&
    typeof pointer.symbolName === 'string' &&
    pointer.symbolName.length >= 1 &&
    pointer.symbolName.length <= 512
  )
}
