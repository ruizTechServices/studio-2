import { describe, expect, it } from 'vitest'

import { isUuid, validateLogInput } from '@/lib/logger/validation'

const USER_ID = '123e4567-e89b-42d3-a456-426614174000'
const CORRELATION_ID = '123e4567-e89b-42d3-b456-426614174001'

function validInput() {
  return {
    level: 'info',
    message: 'Repo import started',
    context: { source: 'github' },
    source: 'server',
  }
}

describe('validateLogInput', () => {
  it('accepts valid input and applies nullable defaults', () => {
    expect(validateLogInput(validInput())).toEqual({
      ok: true,
      value: {
        ...validInput(),
        route: null,
        user_id: null,
        correlation_id: undefined,
      },
    })
  })

  it.each([
    ['non-object payload', null],
    ['array payload', []],
    ['invalid level', { ...validInput(), level: 'trace' }],
    ['invalid source', { ...validInput(), source: 'browser' }],
    ['empty message', { ...validInput(), message: '  ' }],
    ['non-object context', { ...validInput(), context: [] }],
    ['invalid route', { ...validInput(), route: 42 }],
    ['invalid user_id', { ...validInput(), user_id: 'not-a-uuid' }],
    [
      'invalid correlation_id',
      { ...validInput(), correlation_id: 'not-a-uuid' },
    ],
  ])('rejects %s', (_case, input) => {
    expect(validateLogInput(input).ok).toBe(false)
  })

  it('accepts valid user and correlation UUIDs', () => {
    const result = validateLogInput({
      ...validInput(),
      user_id: USER_ID,
      correlation_id: CORRELATION_ID,
    })

    expect(result).toMatchObject({
      ok: true,
      value: {
        user_id: USER_ID,
        correlation_id: CORRELATION_ID,
      },
    })
  })

  it('uses explicit overrides for source, user, route, and correlation ID', () => {
    const result = validateLogInput(
      {
        ...validInput(),
        source: 'server',
        user_id: 'invalid',
        route: 42,
        correlation_id: 'invalid',
      },
      {
        source: 'client',
        user_id: USER_ID,
        route: '/forced-route',
        correlation_id: CORRELATION_ID,
      }
    )

    expect(result).toMatchObject({
      ok: true,
      value: {
        source: 'client',
        user_id: USER_ID,
        route: '/forced-route',
        correlation_id: CORRELATION_ID,
      },
    })
  })
})

describe('isUuid', () => {
  it.each([USER_ID, CORRELATION_ID])('accepts valid UUID %s', (uuid) => {
    expect(isUuid(uuid)).toBe(true)
  })

  it.each(['', 'not-a-uuid', '123e4567-e89b-02d3-a456-426614174000'])(
    'rejects invalid UUID %s',
    (uuid) => {
      expect(isUuid(uuid)).toBe(false)
    }
  )
})
