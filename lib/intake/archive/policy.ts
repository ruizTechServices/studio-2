import type { ArchivePolicy } from '@/lib/intake/archive/contracts'
import { INTAKE_RESOURCE_LIMITS } from '@/lib/intake/policy'
import { WorkerFailure } from '@/lib/intake/worker/failures'

const POLICY_KEYS = [
  'compressedDownloadMaxBytes',
  'extractedContentMaxBytes',
  'archiveEntriesMax',
  'parsedTextFileMaxBytes',
  'pathMaxCharacters',
  'directoryDepthMax',
  'scanDurationMaxMinutes',
  'symbolsMax',
] as const satisfies readonly (keyof ArchivePolicy)[]

const HARD_POLICY: ArchivePolicy = {
  compressedDownloadMaxBytes: INTAKE_RESOURCE_LIMITS.compressedDownloadMaxBytes,
  extractedContentMaxBytes: INTAKE_RESOURCE_LIMITS.extractedContentMaxBytes,
  archiveEntriesMax: INTAKE_RESOURCE_LIMITS.archiveEntriesMax,
  parsedTextFileMaxBytes: INTAKE_RESOURCE_LIMITS.parsedTextFileMaxBytes,
  pathMaxCharacters: INTAKE_RESOURCE_LIMITS.pathMaxCharacters,
  directoryDepthMax: INTAKE_RESOURCE_LIMITS.directoryDepthMax,
  scanDurationMaxMinutes: INTAKE_RESOURCE_LIMITS.scanDurationMaxMinutes,
  symbolsMax: INTAKE_RESOURCE_LIMITS.symbolsMax,
}

export function parseArchivePolicy(
  persisted: Readonly<Record<string, unknown>>
): ArchivePolicy {
  const parsed = {} as Record<keyof ArchivePolicy, number>

  for (const key of POLICY_KEYS) {
    const value = persisted[key]

    if (
      !Number.isSafeInteger(value) ||
      (value as number) < 1 ||
      (value as number) > HARD_POLICY[key]
    ) {
      throw new WorkerFailure(
        'invalid_persisted_limits',
        'Persisted scan limits are invalid.',
        false
      )
    }

    parsed[key] = value as number
  }

  return parsed
}
