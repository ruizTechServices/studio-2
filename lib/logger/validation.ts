import {
  LOG_LEVELS,
  LOG_SOURCES,
  type LogInput,
  type LogLevel,
  type LogSource,
} from '@/lib/logger/types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_INPUT_MESSAGE_LENGTH = 10_000
const MAX_INPUT_ROUTE_LENGTH = 2_048

type LogInputOverrides = Partial<
  Pick<LogInput, 'source' | 'route' | 'user_id' | 'correlation_id'>
>

export type LogValidationResult =
  | { ok: true; value: LogInput }
  | { ok: false; reason: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLogLevel(value: unknown): value is LogLevel {
  return (
    typeof value === 'string' &&
    LOG_LEVELS.some((allowedLevel) => allowedLevel === value)
  )
}

function isLogSource(value: unknown): value is LogSource {
  return (
    typeof value === 'string' &&
    LOG_SOURCES.some((allowedSource) => allowedSource === value)
  )
}

function hasOverride<K extends keyof LogInputOverrides>(
  overrides: LogInputOverrides,
  key: K
): boolean {
  return Object.prototype.hasOwnProperty.call(overrides, key)
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function validateLogInput(
  input: unknown,
  overrides: LogInputOverrides = {}
): LogValidationResult {
  if (!isRecord(input)) {
    return { ok: false, reason: 'Payload must be an object' }
  }

  const level = input.level
  const message = input.message
  const context = input.context ?? {}
  const source = hasOverride(overrides, 'source')
    ? overrides.source
    : input.source
  const route = hasOverride(overrides, 'route') ? overrides.route : input.route
  const userId = hasOverride(overrides, 'user_id')
    ? overrides.user_id
    : input.user_id
  const correlationId = hasOverride(overrides, 'correlation_id')
    ? overrides.correlation_id
    : input.correlation_id

  if (!isLogLevel(level)) {
    return { ok: false, reason: 'Invalid log level' }
  }

  if (
    typeof message !== 'string' ||
    message.trim().length === 0 ||
    message.length > MAX_INPUT_MESSAGE_LENGTH
  ) {
    return { ok: false, reason: 'Invalid log message' }
  }

  if (!isRecord(context)) {
    return { ok: false, reason: 'Log context must be an object' }
  }

  if (!isLogSource(source)) {
    return { ok: false, reason: 'Invalid log source' }
  }

  if (
    route !== undefined &&
    route !== null &&
    (typeof route !== 'string' || route.length > MAX_INPUT_ROUTE_LENGTH)
  ) {
    return { ok: false, reason: 'Invalid route' }
  }

  if (userId !== undefined && userId !== null && !isUuid(userId)) {
    return { ok: false, reason: 'Invalid user ID' }
  }

  if (correlationId !== undefined && !isUuid(correlationId)) {
    return { ok: false, reason: 'Invalid correlation ID' }
  }

  return {
    ok: true,
    value: {
      level,
      message,
      context,
      source,
      route: route ?? null,
      user_id: userId ?? null,
      correlation_id: correlationId,
    },
  }
}
