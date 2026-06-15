import { beforeEach, describe, expect, it, vi } from 'vitest'

const SCAN_ID = '123e4567-e89b-42d3-a456-426614174001'
const PROJECT_ID = '123e4567-e89b-42d3-a456-426614174000'

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('@/lib/server', () => ({
  createServiceRoleClient: mocks.createServiceRoleClient,
}))

import { scanWorkerRepository } from '@/lib/intake/worker/repository'

beforeEach(() => {
  mocks.createServiceRoleClient.mockReturnValue({ rpc: mocks.rpc })
})

describe('scanWorkerRepository', () => {
  it('claims and parses the next scan through the service-role RPC', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          scan_id: SCAN_ID,
          project_id: PROJECT_ID,
          owner: 'owner',
          repository: 'repository',
          default_branch: 'main',
          requested_ref: 'main',
          status: 'validating',
          attempt_count: 1,
          limits: { archiveEntriesMax: 20_000 },
          lease_expires_at: '2026-06-11T12:02:00.000Z',
        },
      ],
      error: null,
    })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).resolves.toEqual({
      scanId: SCAN_ID,
      projectId: PROJECT_ID,
      owner: 'owner',
      repository: 'repository',
      defaultBranch: 'main',
      requestedRef: 'main',
      status: 'validating',
      attemptCount: 1,
      limits: { archiveEntriesMax: 20_000 },
      leaseExpiresAt: '2026-06-11T12:02:00.000Z',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('claim_next_scan', {
      p_worker_id: 'worker-1',
      p_lease_seconds: 120,
      p_max_attempts: 3,
    })
  })

  it('returns null when no scan is eligible', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).resolves.toBeNull()
  })

  it('rejects malformed claim responses safely', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ scan_id: SCAN_ID }], error: null })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).rejects.toMatchObject({ code: 'worker_invalid_response' })
  })

  it('classifies missing service-role configuration safely', async () => {
    mocks.createServiceRoleClient.mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing')
    })

    await expect(
      scanWorkerRepository.claimNextScan({
        workerId: 'worker-1',
        leaseSeconds: 120,
        maxAttempts: 3,
        pollMs: 5_000,
        retryDelaySeconds: 60,
      })
    ).rejects.toMatchObject({
      code: 'worker_repository_unavailable',
      message: 'Scan queue persistence is unavailable.',
    })
  })

  it('calls lifecycle RPCs with safe values', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })

    await expect(
      scanWorkerRepository.failScan(SCAN_ID, 'worker-1', {
        code: 'safe_failure',
        message: 'Safe failure.',
        retryable: false,
      })
    ).resolves.toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith('fail_scan', {
      p_scan_id: SCAN_ID,
      p_worker_id: 'worker-1',
      p_safe_error_code: 'safe_failure',
      p_safe_error_message: 'Safe failure.',
    })
  })

  it('persists metadata-only symbol batches through the service-role RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    const symbols = [
      {
        relativePath: 'src/index.ts',
        kind: 'function' as const,
        name: 'run',
        exported: true,
        importSource: null,
        lineStart: 1,
        lineEnd: 1,
        confidence: 'high' as const,
        category: 'declaration' as const,
      },
    ]

    await expect(
      scanWorkerRepository.persistScanSymbolsBatch(SCAN_ID, 'worker-1', symbols)
    ).resolves.toBe(true)
    expect(mocks.rpc).toHaveBeenCalledWith('persist_scan_symbols_batch', {
      p_scan_id: SCAN_ID,
      p_worker_id: 'worker-1',
      p_symbols: symbols,
    })
  })

  it('persists reusable candidate metadata through the service-role RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    const candidates = [{
      scanId: SCAN_ID,
      projectId: PROJECT_ID,
      relativePath: 'lib/tool.ts',
      symbolName: 'tool',
      symbolKind: 'function' as const,
      assetKind: 'utility' as const,
      exported: true,
      confidence: 'high' as const,
      reuseScore: 80,
      reasons: ['Exported declaration'],
    }]
    await scanWorkerRepository.persistReusableAssetCandidatesBatch(SCAN_ID, 'worker-1', candidates)
    expect(mocks.rpc).toHaveBeenCalledWith('persist_scan_reusable_asset_candidates_batch', {
      p_scan_id: SCAN_ID,
      p_worker_id: 'worker-1',
      p_candidates: candidates,
    })
  })

  it('finalizes Phase 7 with verified candidate metadata count', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    await scanWorkerRepository.completeScan(SCAN_ID, 'worker-1', {
      status: 'completed',
      statistics: { filesDiscovered: 1 },
      warnings: [],
      projectId: PROJECT_ID,
      defaultBranch: 'main',
      resolvedRef: 'main',
      sourceCommitSha: 'a'.repeat(40),
      expectedFileCount: 1,
      expectedSymbolCount: 2,
      expectedReusableAssetCandidateCount: 1,
    })
    expect(mocks.rpc).toHaveBeenCalledWith('finalize_phase_7_scan', expect.objectContaining({
      p_expected_file_count: 1,
      p_expected_symbol_count: 2,
      p_expected_candidate_count: 1,
    }))
  })
})
