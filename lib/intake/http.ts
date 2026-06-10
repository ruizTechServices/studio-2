import type { IntakeApiError, IntakeField } from '@/lib/intake/contracts'

export function intakeNotFound(): Response {
  return Response.json({ error: 'Not found' } satisfies IntakeApiError, {
    status: 404,
  })
}

export function intakeError(
  error: string,
  status: number,
  field?: IntakeField
): Response {
  return Response.json(
    { error, ...(field ? { field } : {}) } satisfies IntakeApiError,
    { status }
  )
}
