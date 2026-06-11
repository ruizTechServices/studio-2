import { after } from 'next/server'

import { sanitizeLogInput } from '@/lib/logger/sanitize'
import { writeLog } from '@/lib/logger/server'
import type { LogInput } from '@/lib/logger/types'
import { isUuid, validateLogInput } from '@/lib/logger/validation'
import { createClient } from '@/lib/server'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 32_768

function inferRoute(request: Request): string | null {
  const referer = request.headers.get('referer')

  if (!referer) {
    return null
  }

  try {
    return new URL(referer).pathname
  } catch {
    return null
  }
}

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.getClaims()
    const subject = data?.claims?.sub

    return !error && isUuid(subject) ? subject : null
  } catch {
    return null
  }
}

function invalidPayload(status = 400): Response {
  return Response.json({ ok: false, error: 'Invalid log payload' }, { status })
}

export async function POST(request: Request): Promise<Response> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return invalidPayload(415)
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0)

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return invalidPayload(413)
  }

  let rawBody: string

  try {
    rawBody = await request.text()
  } catch {
    return invalidPayload()
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return invalidPayload(413)
  }

  let payload: unknown

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return invalidPayload()
  }

  const validation = validateLogInput(payload, {
    source: 'client',
    user_id: null,
  })

  if (!validation.ok) {
    return invalidPayload()
  }

  const sanitizedInput: LogInput = sanitizeLogInput({
    ...validation.value,
    route: validation.value.route ?? inferRoute(request),
    source: 'client',
    user_id: null,
  })

  if (
    sanitizedInput.level === 'debug' &&
    process.env.NODE_ENV === 'production'
  ) {
    return Response.json({ ok: true })
  }

  after(async () => {
    try {
      await writeLog({
        ...sanitizedInput,
        source: 'client',
        user_id: await getAuthenticatedUserId(),
      })
    } catch {
      // Logging must never affect the request flow.
    }
  })

  return Response.json({ ok: true })
}
