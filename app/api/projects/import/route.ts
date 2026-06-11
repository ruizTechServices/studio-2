import { intakeError, intakeNotFound } from '@/lib/intake/http'
import { INTAKE_RESOURCE_LIMITS, isProjectIntakeEnabled } from '@/lib/intake/policy'
import {
  createQueuedScan,
  IntakePersistenceError,
} from '@/lib/intake/repository'
import { validateProjectImportRequest } from '@/lib/intake/validation'
import { logInfo, logWarn } from '@/lib/logger/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 8_192

export async function POST(request: Request): Promise<Response> {
  if (!isProjectIntakeEnabled()) {
    return intakeNotFound()
  }

  if (!request.headers.get('content-type')?.includes('application/json')) {
    return intakeError('Request body must be JSON.', 415)
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0)

  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return intakeError('Request body is too large.', 413)
  }

  let rawBody: string

  try {
    rawBody = await request.text()
  } catch {
    return intakeError('Unable to read request body.', 400)
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return intakeError('Request body is too large.', 413)
  }

  let payload: unknown

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return intakeError('Request body must contain valid JSON.', 400)
  }

  const validation = validateProjectImportRequest(payload)

  if (!validation.ok) {
    return intakeError(validation.error, 400, validation.field)
  }

  try {
    const result = await createQueuedScan(
      validation.value,
      INTAKE_RESOURCE_LIMITS
    )

    await logInfo({
      message: 'Project intake scan created',
      route: '/api/projects/import',
      context: {
        projectId: result.projectId,
        scanId: result.scanId,
        hasExplicitRef: validation.value.ref !== null,
      },
    })

    return Response.json(result, { status: 202 })
  } catch (error) {
    const code =
      error instanceof IntakePersistenceError ? error.code : 'unexpected'

    await logWarn({
      message: 'Project intake scan creation failed',
      route: '/api/projects/import',
      context: { code },
    })

    return intakeError('Project intake persistence is unavailable.', 503)
  }
}
