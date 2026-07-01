import type {
  PromoteShelfAssetRequest,
  ShelfField,
  ShelfName,
  ShelfSearchQuery,
} from '@/lib/shelves/contracts'
import { SHELF_NAMES } from '@/lib/shelves/contracts'

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TAG = /^[a-z0-9][a-z0-9-]{0,31}$/
const SYMBOL_KINDS = new Set([
  'function',
  'component',
  'hook',
  'api_handler',
  'type',
  'constant',
  'unknown',
])

export const SHELF_SEARCH_QUERY_MAX_CHARACTERS = 160
export const SHELF_SEARCH_LIMIT_DEFAULT = 24
export const SHELF_SEARCH_LIMIT_MAX = 50
export const SHELF_TAGS_MAX = 8
export const SHELF_NOTES_MAX_CHARACTERS = 500

export type ShelfValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string; readonly field?: ShelfField }

function invalid(error: string, field?: ShelfField): ShelfValidationResult<never> {
  return { ok: false, error, field }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isShelfName(value: unknown): value is ShelfName {
  return (
    typeof value === 'string' &&
    (SHELF_NAMES as readonly string[]).includes(value)
  )
}

export function validatePromoteShelfAssetRequest(
  payload: unknown
): ShelfValidationResult<PromoteShelfAssetRequest> {
  if (!isRecord(payload)) {
    return invalid('Request body must be a JSON object.')
  }

  if (typeof payload.scanId !== 'string' || !UUID.test(payload.scanId)) {
    return invalid('A valid scan id is required.', 'scanId')
  }
  if (typeof payload.projectId !== 'string' || !UUID.test(payload.projectId)) {
    return invalid('A valid project id is required.', 'projectId')
  }
  if (
    typeof payload.relativePath !== 'string' ||
    payload.relativePath.length < 1 ||
    payload.relativePath.length > 512
  ) {
    return invalid('A valid relative path is required.', 'relativePath')
  }
  if (
    typeof payload.symbolName !== 'string' ||
    payload.symbolName.length < 1 ||
    payload.symbolName.length > 512
  ) {
    return invalid('A valid symbol name is required.', 'symbolName')
  }
  if (
    typeof payload.symbolKind !== 'string' ||
    !SYMBOL_KINDS.has(payload.symbolKind)
  ) {
    return invalid('A valid symbol kind is required.', 'symbolKind')
  }

  let shelf: ShelfName | null = null
  if (payload.shelf !== undefined && payload.shelf !== null) {
    if (!isShelfName(payload.shelf)) {
      return invalid('The shelf name is not recognized.', 'shelf')
    }
    shelf = payload.shelf
  }

  const tags: string[] = []
  if (payload.tags !== undefined && payload.tags !== null) {
    if (!Array.isArray(payload.tags) || payload.tags.length > SHELF_TAGS_MAX) {
      return invalid(`Provide at most ${SHELF_TAGS_MAX} tags.`, 'tags')
    }
    for (const tag of payload.tags) {
      if (typeof tag !== 'string' || !TAG.test(tag)) {
        return invalid(
          'Tags must be lowercase letters, digits, and hyphens (max 32 characters).',
          'tags'
        )
      }
      if (!tags.includes(tag)) {
        tags.push(tag)
      }
    }
  }

  let notes: string | null = null
  if (payload.notes !== undefined && payload.notes !== null) {
    if (typeof payload.notes !== 'string') {
      return invalid('Notes must be text.', 'notes')
    }
    const trimmed = payload.notes.trim()
    if (trimmed.length > SHELF_NOTES_MAX_CHARACTERS) {
      return invalid(
        `Notes must be at most ${SHELF_NOTES_MAX_CHARACTERS} characters.`,
        'notes'
      )
    }
    notes = trimmed.length > 0 ? trimmed : null
  }

  return {
    ok: true,
    value: {
      scanId: payload.scanId.toLowerCase(),
      projectId: payload.projectId.toLowerCase(),
      relativePath: payload.relativePath,
      symbolName: payload.symbolName,
      symbolKind: payload.symbolKind as PromoteShelfAssetRequest['symbolKind'],
      shelf,
      tags,
      notes,
    },
  }
}

export function validateShelfSearchQuery(parameters: {
  readonly query?: string | null
  readonly shelf?: string | null
  readonly limit?: string | null
}): ShelfValidationResult<ShelfSearchQuery> {
  let query: string | null = null
  if (typeof parameters.query === 'string') {
    const trimmed = parameters.query.trim()
    if (trimmed.length > SHELF_SEARCH_QUERY_MAX_CHARACTERS) {
      return invalid(
        `Search queries must be at most ${SHELF_SEARCH_QUERY_MAX_CHARACTERS} characters.`,
        'query'
      )
    }
    query = trimmed.length > 0 ? trimmed : null
  }

  let shelf: ShelfName | null = null
  if (
    typeof parameters.shelf === 'string' &&
    parameters.shelf.length > 0
  ) {
    if (!isShelfName(parameters.shelf)) {
      return invalid('The shelf name is not recognized.', 'shelf')
    }
    shelf = parameters.shelf
  }

  let limit = SHELF_SEARCH_LIMIT_DEFAULT
  if (typeof parameters.limit === 'string' && parameters.limit.length > 0) {
    const parsed = Number(parameters.limit)
    if (
      !Number.isSafeInteger(parsed) ||
      parsed < 1 ||
      parsed > SHELF_SEARCH_LIMIT_MAX
    ) {
      return invalid(
        `The limit must be between 1 and ${SHELF_SEARCH_LIMIT_MAX}.`,
        'limit'
      )
    }
    limit = parsed
  }

  return { ok: true, value: { query, shelf, limit } }
}
