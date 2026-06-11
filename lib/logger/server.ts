import { randomUUID } from 'node:crypto'

import { sanitizeContext, sanitizeLogInput } from '@/lib/logger/sanitize'
import type { LogDetails, LogInput, LogLevel } from '@/lib/logger/types'
import { validateLogInput } from '@/lib/logger/validation'
import { createServiceRoleClient } from '@/lib/server'

function reportLoggingFailure(error: unknown): void {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[logger] Failed to write log entry')
    return
  }

  console.warn('[logger] Failed to write log entry', sanitizeContext({ error }))
}

function createServerLogInput(level: LogLevel, details: LogDetails): LogInput {
  return {
    ...details,
    level,
    source: 'server',
  }
}

export async function writeLog(input: LogInput): Promise<void> {
  if (input.level === 'debug' && process.env.NODE_ENV === 'production') {
    return
  }

  try {
    const sanitizedInput = sanitizeLogInput({
      ...input,
      correlation_id: input.correlation_id ?? randomUUID(),
    })
    const validation = validateLogInput(sanitizedInput)

    if (!validation.ok || !validation.value.correlation_id) {
      reportLoggingFailure(
        validation.ok ? 'Missing correlation ID' : validation.reason
      )
      return
    }

    const { error } = await createServiceRoleClient()
      .from('logs')
      .insert({
        level: validation.value.level,
        message: validation.value.message,
        context: validation.value.context ?? {},
        source: validation.value.source,
        route: validation.value.route ?? null,
        user_id: validation.value.user_id ?? null,
        correlation_id: validation.value.correlation_id,
      })

    if (error) {
      reportLoggingFailure(error)
    }
  } catch (error) {
    reportLoggingFailure(error)
  }
}

export async function logDebug(details: LogDetails): Promise<void> {
  await writeLog(createServerLogInput('debug', details))
}

export async function logInfo(details: LogDetails): Promise<void> {
  await writeLog(createServerLogInput('info', details))
}

export async function logWarn(details: LogDetails): Promise<void> {
  await writeLog(createServerLogInput('warn', details))
}

export async function logError(details: LogDetails): Promise<void> {
  await writeLog(createServerLogInput('error', details))
}

export async function logFatal(details: LogDetails): Promise<void> {
  await writeLog(createServerLogInput('fatal', details))
}

export async function logAudit(details: LogDetails): Promise<void> {
  await writeLog(createServerLogInput('audit', details))
}
