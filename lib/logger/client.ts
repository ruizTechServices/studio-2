'use client'

import { sanitizeLogInput } from '@/lib/logger/sanitize'
import type { LogDetails, LogInput, LogLevel } from '@/lib/logger/types'
import { validateLogInput } from '@/lib/logger/validation'

export type ClientLogDetails = Omit<LogDetails, 'user_id'>

function createClientLogInput(
  level: LogLevel,
  details: ClientLogDetails
): LogInput {
  return {
    ...details,
    level,
    source: 'client',
    route:
      details.route ??
      (typeof window === 'undefined' ? null : window.location.pathname),
    user_id: null,
  }
}

async function sendClientLog(
  level: LogLevel,
  details: ClientLogDetails
): Promise<void> {
  if (level === 'debug' && process.env.NODE_ENV === 'production') {
    return
  }

  try {
    const validation = validateLogInput(createClientLogInput(level, details))

    if (!validation.ok) {
      return
    }

    const payload = sanitizeLogInput(validation.value)
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      keepalive: true,
    })
  } catch {
    // Logging must never affect the browser flow.
  }
}

export async function logDebug(details: ClientLogDetails): Promise<void> {
  await sendClientLog('debug', details)
}

export async function logInfo(details: ClientLogDetails): Promise<void> {
  await sendClientLog('info', details)
}

export async function logWarn(details: ClientLogDetails): Promise<void> {
  await sendClientLog('warn', details)
}

export async function logError(details: ClientLogDetails): Promise<void> {
  await sendClientLog('error', details)
}

export async function logFatal(details: ClientLogDetails): Promise<void> {
  await sendClientLog('fatal', details)
}

export async function logAudit(details: ClientLogDetails): Promise<void> {
  await sendClientLog('audit', details)
}
