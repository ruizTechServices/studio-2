export const LOG_LEVELS = [
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'audit',
] as const

export const LOG_SOURCES = ['server', 'client'] as const

export type LogLevel = (typeof LOG_LEVELS)[number]
export type LogSource = (typeof LOG_SOURCES)[number]
export type LogContext = Record<string, unknown>

export interface LogInput {
  level: LogLevel
  message: string
  context?: LogContext
  source: LogSource
  route?: string | null
  user_id?: string | null
  correlation_id?: string
}

export interface StoredLogEntry {
  id: string
  level: LogLevel
  message: string
  context: LogContext
  source: LogSource
  route: string | null
  user_id: string | null
  correlation_id: string
  created_at: string
}

export type LogDetails = Omit<LogInput, 'level' | 'source'>
