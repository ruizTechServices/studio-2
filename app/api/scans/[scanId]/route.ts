import { intakeError, intakeNotFound } from '@/lib/intake/http'
import { isProjectIntakeEnabled } from '@/lib/intake/policy'
import { getScanStatus, IntakePersistenceError } from '@/lib/intake/repository'
import { isUuid } from '@/lib/intake/validation'
import { logWarn } from '@/lib/logger/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ScanRouteContext {
  readonly params: Promise<{ scanId: string }>
}

export async function GET(
  _request: Request,
  context: ScanRouteContext
): Promise<Response> {
  if (!isProjectIntakeEnabled()) {
    return intakeNotFound()
  }

  const { scanId } = await context.params

  if (!isUuid(scanId)) {
    return intakeError('Scan ID must be a valid UUID.', 400)
  }

  try {
    const scan = await getScanStatus(scanId)

    if (!scan) {
      return intakeNotFound()
    }

    return Response.json(scan)
  } catch (error) {
    const code =
      error instanceof IntakePersistenceError ? error.code : 'unexpected'

    await logWarn({
      message: 'Project intake scan status lookup failed',
      route: '/api/scans/[scanId]',
      context: { code, scanId },
    })

    return intakeError('Scan status is unavailable.', 503)
  }
}
