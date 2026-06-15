import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { downloadBoundedArchive } from '@/lib/intake/archive/download'
import { resolveGitHubSource } from '@/lib/intake/archive/github'
import { inventoryArchive } from '@/lib/intake/archive/inventory'
import { parseArchivePolicy } from '@/lib/intake/archive/policy'
import { buildGitHubArchiveUrl } from '@/lib/intake/github-url'
import { validateGitHubRepositoryUrl, validateGitRef } from '@/lib/intake/validation'
import type {
  ScanClaim,
  ScanCompletion,
  ScanProcessorContext,
} from '@/lib/intake/worker/contracts'
import { WorkerFailure } from '@/lib/intake/worker/failures'
import { buildReusableAssetCandidates } from '@/lib/intake/reusable-assets/classify'

async function requireLease(value: Promise<boolean>): Promise<void> {
  if (!(await value)) {
    throw new WorkerFailure(
      'lease_lost',
      'Scan lease is no longer owned by this worker.',
      true
    )
  }
}

export async function processPhase3Archive(
  claim: ScanClaim,
  context: ScanProcessorContext
): Promise<ScanCompletion> {
  if (
    !claim.scanId ||
    !claim.projectId ||
    !claim.owner ||
    !claim.repository ||
    claim.attemptCount < 1
  ) {
    throw new WorkerFailure('invalid_scan_metadata', 'Scan metadata is invalid.', false)
  }

  const policy = parseArchivePolicy(claim.limits)
  const repositoryValidation = validateGitHubRepositoryUrl(
    `https://github.com/${claim.owner}/${claim.repository}`
  )
  const refValidation = validateGitRef(claim.requestedRef)
  if (
    !repositoryValidation.ok ||
    repositoryValidation.value.owner !== claim.owner ||
    repositoryValidation.value.repository !== claim.repository ||
    !refValidation.ok
  ) {
    throw new WorkerFailure('invalid_scan_metadata', 'Scan metadata is invalid.', false)
  }
  const repository = repositoryValidation.value
  let temporaryDirectory: string | null = null

  try {
    await requireLease(
      context.repository.transitionScanStage(claim.scanId, context.workerId, 'validating')
    )
    const source = await resolveGitHubSource(repository, claim.requestedRef, context.signal)

    await requireLease(
      context.repository.transitionScanStage(claim.scanId, context.workerId, 'fetching')
    )
    temporaryDirectory = await mkdtemp(join(tmpdir(), `studio-2-${claim.scanId}-`))
    const archivePath = join(temporaryDirectory, 'repository.tar.gz')
    await downloadBoundedArchive(
      buildGitHubArchiveUrl(repository, source.commitSha),
      archivePath,
      policy.compressedDownloadMaxBytes,
      context.signal
    )

    await requireLease(
      context.repository.transitionScanStage(claim.scanId, context.workerId, 'extracting')
    )
    const inventory = await inventoryArchive(archivePath, policy, context.signal)

    await requireLease(
      context.repository.transitionScanStage(claim.scanId, context.workerId, 'persisting')
    )
    await requireLease(
      context.repository.beginScanInventory(claim.scanId, context.workerId)
    )
    for (let index = 0; index < inventory.files.length; index += 500) {
      await requireLease(
        context.repository.persistScanFilesBatch(
          claim.scanId,
          context.workerId,
          inventory.files.slice(index, index + 500)
        )
      )
    }
    for (let index = 0; index < inventory.symbols.length; index += 500) {
      await requireLease(
        context.repository.persistScanSymbolsBatch(
          claim.scanId,
          context.workerId,
          inventory.symbols.slice(index, index + 500)
        )
      )
    }
    const candidates = buildReusableAssetCandidates(
      claim.scanId,
      claim.projectId,
      inventory.files,
      inventory.symbols
    )
    for (let index = 0; index < candidates.length; index += 500) {
      await requireLease(
        context.repository.persistReusableAssetCandidatesBatch(
          claim.scanId,
          context.workerId,
          candidates.slice(index, index + 500)
        )
      )
    }

    return {
      status:
        inventory.warnings.length > 0 ? 'completed_with_warnings' : 'completed',
      statistics: { ...inventory.statistics },
      warnings: inventory.warnings,
      projectId: claim.projectId,
      defaultBranch: source.defaultBranch,
      resolvedRef: source.resolvedRef,
      sourceCommitSha: source.commitSha,
      expectedFileCount: inventory.files.length,
      expectedSymbolCount: inventory.symbols.length,
      expectedReusableAssetCandidateCount: candidates.length,
    }
  } finally {
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true })
    }
  }
}
