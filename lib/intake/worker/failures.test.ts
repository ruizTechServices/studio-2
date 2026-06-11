import { describe, expect, it } from 'vitest'

import {
  classifyWorkerFailure,
  shouldRetryFailure,
  WorkerFailure,
} from '@/lib/intake/worker/failures'

describe('classifyWorkerFailure', () => {
  it('preserves explicitly safe worker failures', () => {
    expect(
      classifyWorkerFailure(
        new WorkerFailure('phase_3_not_implemented', 'Deferred safely.', false)
      )
    ).toEqual({
      code: 'phase_3_not_implemented',
      message: 'Deferred safely.',
      retryable: false,
    })
  })

  it('redacts unexpected failures', () => {
    expect(classifyWorkerFailure(new Error('secret database details'))).toEqual({
      code: 'worker_processing_failed',
      message: 'Scan processing failed safely.',
      retryable: true,
    })
  })
})

describe('shouldRetryFailure', () => {
  it('retries retryable failures while attempts remain', () => {
    expect(
      shouldRetryFailure(
        { code: 'temporary', message: 'Temporary failure.', retryable: true },
        1,
        3
      )
    ).toBe(true)
  })

  it('stops on terminal failures or exhausted attempts', () => {
    expect(
      shouldRetryFailure(
        { code: 'terminal', message: 'Terminal failure.', retryable: false },
        1,
        3
      )
    ).toBe(false)
    expect(
      shouldRetryFailure(
        { code: 'temporary', message: 'Temporary failure.', retryable: true },
        3,
        3
      )
    ).toBe(false)
  })
})
