import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  sanitizeContext,
  sanitizeLogInput,
  sanitizeMessage,
  sanitizeRoute,
} from '@/lib/logger/sanitize'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('sanitizeMessage and sanitizeRoute', () => {
  it('truncates long messages', () => {
    const sanitized = sanitizeMessage('x'.repeat(1_100))

    expect(sanitized).toHaveLength(1_011)
    expect(sanitized.endsWith('[TRUNCATED]')).toBe(true)
  })

  it('removes query strings and hashes from routes', () => {
    expect(sanitizeRoute('/projects/1?token=secret#details')).toBe('/projects/1')
    expect(sanitizeRoute('/projects/1#details')).toBe('/projects/1')
  })

  it('returns null for missing routes', () => {
    expect(sanitizeRoute(undefined)).toBeNull()
    expect(sanitizeRoute(null)).toBeNull()
    expect(sanitizeRoute('')).toBeNull()
  })
})

describe('sanitizeContext', () => {
  it.each([
    'password',
    'token',
    'access_token',
    'refresh_token',
    'apiKey',
    'api_key',
    'secret',
    'authorization',
    'cookie',
    'session',
    'jwt',
    'bearer',
    'privateKey',
    'service_role',
  ])('redacts the sensitive key %s', (key) => {
    expect(sanitizeContext({ [key]: 'sensitive' })).toEqual({
      [key]: '[REDACTED]',
    })
  })

  it('redacts nested sensitive keys', () => {
    expect(
      sanitizeContext({ safe: { nested: { access_token: 'sensitive' } } })
    ).toEqual({
      safe: { nested: { access_token: '[REDACTED]' } },
    })
  })

  it('handles and bounds arrays safely', () => {
    const sanitized = sanitizeContext({
      items: Array.from({ length: 60 }, (_, index) => ({
        index,
        password: 'sensitive',
      })),
    })

    expect(sanitized.items).toHaveLength(50)
    expect((sanitized.items as Array<Record<string, unknown>>)[0]).toEqual({
      index: 0,
      password: '[REDACTED]',
    })
  })

  it('normalizes Error objects without storing the raw Error', () => {
    vi.stubEnv('NODE_ENV', 'production')

    expect(sanitizeContext({ error: new TypeError('token=secret') })).toEqual({
      error: {
        name: 'TypeError',
        message: 'token=[REDACTED]',
      },
    })
  })

  it('handles circular references safely', () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(sanitizeContext(circular)).toEqual({ self: '[CIRCULAR]' })
  })

  it('handles functions, symbols, and undefined safely', () => {
    expect(
      sanitizeContext({
        fn: () => undefined,
        symbol: Symbol('value'),
        missing: undefined,
      })
    ).toEqual({
      fn: '[UNSERIALIZABLE]',
      symbol: '[UNSERIALIZABLE]',
      missing: '[UNSERIALIZABLE]',
    })
  })
})

describe('sanitizeLogInput', () => {
  it('sanitizes message, context, and route together', () => {
    expect(
      sanitizeLogInput({
        level: 'info',
        message: 'authorization=secret',
        context: { password: 'secret' },
        source: 'client',
        route: '/projects?token=secret',
      })
    ).toEqual({
      level: 'info',
      message: 'authorization=[REDACTED]',
      context: { password: '[REDACTED]' },
      source: 'client',
      route: '/projects',
    })
  })
})
