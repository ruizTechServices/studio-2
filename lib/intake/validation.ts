import type {
  IntakeField,
  ProjectImportRequest,
} from '@/lib/intake/contracts'

const GITHUB_REPOSITORY_URL =
  /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)\/([A-Za-z0-9._-]{1,100})$/
const INVALID_REF_CHARACTERS = /[\u0000-\u0020\u007f~^:?*[\]\\]/
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface ValidatedGitHubRepository {
  readonly owner: string
  readonly repository: string
  readonly canonicalUrl: string
}

export interface ValidatedImportRequest extends ValidatedGitHubRepository {
  readonly ref: string | null
}

export type IntakeValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false
      readonly error: string
      readonly field?: IntakeField
    }

function invalid(
  error: string,
  field?: IntakeField
): IntakeValidationResult<never> {
  return { ok: false, error, field }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateGitHubRepositoryUrl(
  value: unknown
): IntakeValidationResult<ValidatedGitHubRepository> {
  if (typeof value !== 'string' || value.length === 0) {
    return invalid('Enter a public GitHub repository URL.', 'repositoryUrl')
  }

  const match = GITHUB_REPOSITORY_URL.exec(value)

  if (!match) {
    return invalid(
      'Use the exact format https://github.com/owner/repository.',
      'repositoryUrl'
    )
  }

  const owner = match[1]
  const repository = match[2]

  if (owner.includes('--')) {
    return invalid('The GitHub owner name is malformed.', 'repositoryUrl')
  }

  if (
    repository === '.' ||
    repository === '..' ||
    repository.toLowerCase().endsWith('.git')
  ) {
    return invalid('The GitHub repository name is malformed.', 'repositoryUrl')
  }

  const normalizedOwner = owner.toLowerCase()
  const normalizedRepository = repository.toLowerCase()

  return {
    ok: true,
    value: {
      owner: normalizedOwner,
      repository: normalizedRepository,
      canonicalUrl: `https://github.com/${normalizedOwner}/${normalizedRepository}`,
    },
  }
}

export function validateGitRef(
  value: unknown
): IntakeValidationResult<string | null> {
  if (value === undefined || value === null || value === '') {
    return { ok: true, value: null }
  }

  if (typeof value !== 'string') {
    return invalid('The ref must be a string.', 'ref')
  }

  if (value.length > 255) {
    return invalid('The ref must be 255 characters or fewer.', 'ref')
  }

  if (
    value.trim() !== value ||
    value === '@' ||
    value.startsWith('/') ||
    value.endsWith('/') ||
    value.endsWith('.') ||
    value.includes('//') ||
    value.includes('..') ||
    value.includes('@{') ||
    INVALID_REF_CHARACTERS.test(value)
  ) {
    return invalid('Enter a valid Git branch, tag, or commit ref.', 'ref')
  }

  const hasInvalidSegment = value
    .split('/')
    .some((segment) => segment.startsWith('.') || segment.endsWith('.lock'))

  if (hasInvalidSegment) {
    return invalid('Enter a valid Git branch, tag, or commit ref.', 'ref')
  }

  return { ok: true, value }
}

export function validateProjectImportRequest(
  input: unknown
): IntakeValidationResult<ValidatedImportRequest> {
  if (!isRecord(input)) {
    return invalid('Request body must be a JSON object.')
  }

  const allowedKeys = new Set<keyof ProjectImportRequest>([
    'repositoryUrl',
    'ref',
  ])
  const hasUnknownKey = Object.keys(input).some(
    (key) => !allowedKeys.has(key as keyof ProjectImportRequest)
  )

  if (hasUnknownKey) {
    return invalid('Request body contains unsupported fields.')
  }

  const repository = validateGitHubRepositoryUrl(input.repositoryUrl)

  if (!repository.ok) {
    return repository
  }

  const ref = validateGitRef(input.ref)

  if (!ref.ok) {
    return ref
  }

  return {
    ok: true,
    value: {
      ...repository.value,
      ref: ref.value,
    },
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}
