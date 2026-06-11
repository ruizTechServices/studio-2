import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LogInput } from '@/lib/logger/types'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  randomUUID: vi.fn(() => '123e4567-e89b-42d3-a456-426614174000'),
}))

vi.mock('@/lib/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

vi.mock('node:crypto', () => ({
  randomUUID: mocks.randomUUID,
}))

import {
  logAudit,
  logDebug,
  logError,
  logFatal,
  logInfo,
  logWarn,
  writeLog,
} from '@/lib/logger/server'

beforeEach(() => {
  mocks.insert.mockResolvedValue({ error: null })
  mocks.from.mockReturnValue({ insert: mocks.insert })
  mocks.createServiceRoleClient.mockReturnValue({ from: mocks.from })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  vi.stubEnv('NODE_ENV', 'test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('server logger helpers', () => {
  it.each([
    ['debug', logDebug],
    ['info', logInfo],
    ['warn', logWarn],
    ['error', logError],
    ['fatal', logFatal],
    ['audit', logAudit],
  ] as const)('writes %s logs with server defaults', async (level, helper) => {
    await helper({ message: `${level} message` })

    expect(mocks.from).toHaveBeenCalledWith('logs')
    expect(mocks.insert).toHaveBeenCalledWith({
      level,
      message: `${level} message`,
      context: {},
      source: 'server',
      route: null,
      user_id: null,
      correlation_id: '123e4567-e89b-42d3-a456-426614174000',
    })
  })

  it('preserves a provided correlation ID and redacts context', async () => {
    const correlationId = '123e4567-e89b-42d3-b456-426614174001'

    await logInfo({
      message: 'Import started',
      correlation_id: correlationId,
      context: { password: 'sensitive' },
    })

    expect(mocks.randomUUID).not.toHaveBeenCalled()
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation_id: correlationId,
        context: { password: '[REDACTED]' },
      })
    )
  })

  it('skips debug logs in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    await logDebug({ message: 'suppressed' })

    expect(mocks.createServiceRoleClient).not.toHaveBeenCalled()
  })
})

describe('writeLog failure isolation', () => {
  it('does not throw when Supabase insert returns an error', async () => {
    mocks.insert.mockResolvedValue({ error: new Error('database unavailable') })

    await expect(logInfo({ message: 'safe failure' })).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalled()
  })

  it('does not throw when service-role client creation fails', async () => {
    mocks.createServiceRoleClient.mockImplementation(() => {
      throw new Error('missing environment')
    })

    await expect(logInfo({ message: 'safe failure' })).resolves.toBeUndefined()
    expect(console.warn).toHaveBeenCalled()
  })

  it('does not insert or throw for invalid input', async () => {
    const invalidInput = {
      level: 'info',
      message: '',
      source: 'server',
    } as LogInput

    await expect(writeLog(invalidInput)).resolves.toBeUndefined()
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(console.warn).toHaveBeenCalled()
  })
})
