import { beforeEach, describe, expect, it, vi } from 'vitest'

const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000'
const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  eq: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
  rpc: vi.fn(),
  select: vi.fn(),
}))

vi.mock('@/lib/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import {
  createQueuedScan,
  getScanStatus,
} from '@/lib/intake/repository'

beforeEach(() => {
  mocks.createServiceRoleClient.mockReturnValue({
    rpc: mocks.rpc,
    from: mocks.from,
  })
  mocks.from.mockReturnValue({ select: mocks.select })
  mocks.select.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockReturnValue({ maybeSingle: mocks.maybeSingle })
})

describe('createQueuedScan', () => {
  it('calls the service-role transactional RPC and parses its result', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          project_id: PROJECT_ID,
          scan_id: SCAN_ID,
          status: 'queued',
        },
      ],
      error: null,
    })

    const result = await createQueuedScan(
      {
        owner: 'ruiztechservices',
        repository: 'studio-2',
        canonicalUrl: 'https://github.com/ruiztechservices/studio-2',
        ref: 'app-shell',
      },
      { archiveEntriesMax: 20_000 }
    )

    expect(mocks.rpc).toHaveBeenCalledWith('create_project_scan', {
      p_owner: 'ruiztechservices',
      p_repository: 'studio-2',
      p_canonical_url: 'https://github.com/ruiztechservices/studio-2',
      p_requested_ref: 'app-shell',
      p_limits: { archiveEntriesMax: 20_000 },
    })
    expect(result).toEqual({
      projectId: PROJECT_ID,
      scanId: SCAN_ID,
      status: 'queued',
    })
  })

  it('classifies missing service-role configuration safely', async () => {
    mocks.createServiceRoleClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
    })

    await expect(
      createQueuedScan(
        {
          owner: 'owner',
          repository: 'repository',
          canonicalUrl: 'https://github.com/owner/repository',
          ref: null,
        },
        {}
      )
    ).rejects.toMatchObject({ code: 'config' })
  })
})

describe('getScanStatus', () => {
  it('returns only the safe scan response fields', async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: SCAN_ID,
        project_id: PROJECT_ID,
        status: 'queued',
        statistics: {},
        warnings: [],
        safe_error_message: null,
        summary_status: 'not_started',
        source_commit_sha: 'must-not-leak',
      },
      error: null,
    })

    await expect(getScanStatus(SCAN_ID)).resolves.toEqual({
      scanId: SCAN_ID,
      projectId: PROJECT_ID,
      status: 'queued',
      statistics: {},
      warnings: [],
      safeError: null,
      summaryStatus: 'not_started',
    })
  })

  it('returns null for unknown scans', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getScanStatus(SCAN_ID)).resolves.toBeNull()
  })
})
