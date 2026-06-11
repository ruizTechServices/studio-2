import type { SafeWorkerFailure } from '@/lib/intake/worker/contracts'

export class WorkerFailure extends Error implements SafeWorkerFailure {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean
  ) {
    super(message)
    this.name = 'WorkerFailure'
  }
}

export function classifyWorkerFailure(error: unknown): SafeWorkerFailure {
  if (error instanceof WorkerFailure) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    }
  }

  return {
    code: 'worker_processing_failed',
    message: 'Scan processing failed safely.',
    retryable: true,
  }
}

export function shouldRetryFailure(
  failure: SafeWorkerFailure,
  attemptCount: number,
  maxAttempts: number
): boolean {
  return failure.retryable && attemptCount < maxAttempts
}
