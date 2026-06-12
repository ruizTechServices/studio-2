import { readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'

import { pack } from 'tar-stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { INTAKE_RESOURCE_LIMITS } from '@/lib/intake/policy'
import type {
  ScanClaim,
  ScanWorkerRepository,
} from '@/lib/intake/worker/contracts'
import { processPhase3Archive } from '@/lib/intake/worker/processor'

const scanId = '123e4567-e89b-42d3-a456-426614174001'
const sha = 'a'.repeat(40)
const claim: ScanClaim = {
  scanId,
  projectId: '123e4567-e89b-42d3-a456-426614174000',
  owner: 'owner',
  repository: 'repository',
  defaultBranch: null,
  requestedRef: null,
  status: 'validating',
  attemptCount: 1,
  limits: INTAKE_RESOURCE_LIMITS,
  leaseExpiresAt: '2026-06-12T12:02:00.000Z',
}

function repository(): ScanWorkerRepository {
  return {
    claimNextScan: vi.fn(),
    heartbeatScan: vi.fn(),
    transitionScanStage: vi.fn().mockResolvedValue(true),
    beginScanInventory: vi.fn().mockResolvedValue(true),
    persistScanFilesBatch: vi.fn().mockResolvedValue(true),
    releaseScanForRetry: vi.fn(),
    failScan: vi.fn(),
    completeScan: vi.fn(),
  }
}

async function safeArchive(): Promise<Buffer> {
  const stream = pack()
  const chunks: Buffer[] = []
  stream.on('data', (chunk: Buffer) => chunks.push(chunk))
  stream.entry({ name: 'repository-sha/file.ts' }, 'export const value = 1\n')
  stream.finalize()
  await new Promise<void>((resolve, reject) => {
    stream.once('end', resolve)
    stream.once('error', reject)
  })
  return gzipSync(Buffer.concat(chunks))
}

async function leftovers(): Promise<string[]> {
  return (await readdir(tmpdir())).filter((name) => name.startsWith(`studio-2-${scanId}-`))
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('processPhase3Archive', () => {
  it('persists metadata batches and removes temporary files after success', async () => {
    const archive = await safeArchive()
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input)
        if (url.endsWith('/repos/owner/repository')) {
          return Response.json({ private: false, default_branch: 'main' })
        }
        if (url.endsWith('/branches/main')) {
          return Response.json({ commit: { sha } })
        }
        return new Response(new Uint8Array(archive))
      })
    )
    const persistence = repository()

    await expect(
      processPhase3Archive(claim, {
        repository: persistence,
        workerId: 'worker-1',
        signal: new AbortController().signal,
      })
    ).resolves.toMatchObject({
      status: 'completed',
      expectedFileCount: 1,
      sourceCommitSha: sha,
    })
    expect(persistence.persistScanFilesBatch).toHaveBeenCalledWith(
      scanId,
      'worker-1',
      [expect.objectContaining({ relativePath: 'file.ts' })]
    )
    expect(await leftovers()).toEqual([])
  })

  it('removes temporary files after malformed archive failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async (input) => {
        const url = String(input)
        if (url.endsWith('/repos/owner/repository')) {
          return Response.json({ private: false, default_branch: 'main' })
        }
        if (url.endsWith('/branches/main')) {
          return Response.json({ commit: { sha } })
        }
        return new Response('not a gzip archive')
      })
    )

    await expect(
      processPhase3Archive(claim, {
        repository: repository(),
        workerId: 'worker-1',
        signal: new AbortController().signal,
      })
    ).rejects.toMatchObject({ code: 'malformed_archive' })
    expect(await leftovers()).toEqual([])
  })
})
