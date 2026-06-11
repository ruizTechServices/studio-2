import type { LogContext, LogInput } from '@/lib/logger/types'

const MAX_STRING_LENGTH = 2_000
const MAX_MESSAGE_LENGTH = 1_000
const MAX_ROUTE_LENGTH = 500
const MAX_DEPTH = 5
const MAX_ARRAY_ITEMS = 50
const MAX_OBJECT_KEYS = 50

const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pass',
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'secret',
  'authorization',
  'cookie',
  'setcookie',
  'session',
  'jwt',
  'bearer',
  'privatekey',
  'servicerole',
]

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSensitiveKey(key: string): boolean {
  const normalizedKey = normalizeKey(key)

  return SENSITIVE_KEYS.some(
    (sensitiveKey) =>
      normalizedKey === sensitiveKey || normalizedKey.endsWith(sensitiveKey)
  )
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength)}[TRUNCATED]`
}

function redactSensitiveText(value: string): string {
  return value
    .replace(
      /\b(bearer)\s+[a-z0-9._~+/=-]+/gi,
      '$1 [REDACTED]'
    )
    .replace(
      /\b(password|passwd|pass|token|access_token|refresh_token|api[_-]?key|secret|authorization|cookie|session|jwt|private[_-]?key|service[_-]?role)\b(\s*[:=]\s*)[^\s,;&]+/gi,
      '$1$2[REDACTED]'
    )
    .replace(
      /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
      '[REDACTED_JWT]'
    )
}

function sanitizeString(value: string, maxLength = MAX_STRING_LENGTH): string {
  return truncate(redactSensitiveText(value), maxLength)
}

function sanitizeError(error: Error, seen: WeakSet<object>): LogContext {
  const normalizedError: LogContext = {
    name: sanitizeString(error.name),
    message: sanitizeString(error.message),
  }

  if (process.env.NODE_ENV !== 'production' && error.stack) {
    normalizedError.stack = sanitizeString(error.stack)
  }

  seen.add(error)
  return normalizedError
}

function sanitizeValue(
  value: unknown,
  depth: number,
  seen: WeakSet<object>
): unknown {
  if (value === null || typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : String(value)
  }

  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    return '[UNSERIALIZABLE]'
  }

  if (depth >= MAX_DEPTH) {
    return '[MAX_DEPTH]'
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '[INVALID_DATE]' : value.toISOString()
  }

  if (value instanceof Error) {
    return sanitizeError(value, seen)
  }

  if (typeof value !== 'object') {
    return '[UNSUPPORTED_VALUE]'
  }

  if (seen.has(value)) {
    return '[CIRCULAR]'
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1, seen))
  }

  const sanitizedObject: LogContext = {}

  try {
    for (const [key, nestedValue] of Object.entries(value).slice(
      0,
      MAX_OBJECT_KEYS
    )) {
      sanitizedObject[key] = isSensitiveKey(key)
        ? '[REDACTED]'
        : sanitizeValue(nestedValue, depth + 1, seen)
    }
  } catch {
    return '[UNSERIALIZABLE_OBJECT]'
  }

  return sanitizedObject
}

export function sanitizeMessage(message: string): string {
  return sanitizeString(message, MAX_MESSAGE_LENGTH)
}

export function sanitizeRoute(route: string | null | undefined): string | null {
  if (!route) {
    return null
  }

  return sanitizeString(route.split(/[?#]/, 1)[0], MAX_ROUTE_LENGTH)
}

export function sanitizeContext(context: LogContext = {}): LogContext {
  const sanitized = sanitizeValue(context, 0, new WeakSet<object>())

  return typeof sanitized === 'object' &&
    sanitized !== null &&
    !Array.isArray(sanitized)
    ? (sanitized as LogContext)
    : {}
}

export function sanitizeLogInput(input: LogInput): LogInput {
  return {
    ...input,
    message: sanitizeMessage(input.message),
    context: sanitizeContext(input.context),
    route: sanitizeRoute(input.route),
  }
}
