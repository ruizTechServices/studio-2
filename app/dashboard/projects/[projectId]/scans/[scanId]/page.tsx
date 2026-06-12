import { notFound } from 'next/navigation'

import {
  ScanResultsUnavailable,
  ScanResultsView,
} from '@/components/intake/scan-results/scan-results-view'
import { isProjectIntakeEnabled } from '@/lib/intake/policy'
import {
  getScanResults,
  ScanResultsPersistenceError,
} from '@/lib/intake/results/repository'
import { isUuid } from '@/lib/intake/validation'
import { logWarn } from '@/lib/logger/server'
import type { ScanResults } from '@/lib/intake/results/contracts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ScanResultsPageProps {
  readonly params: Promise<{ projectId: string; scanId: string }>
}

export default async function ScanResultsPage({ params }: ScanResultsPageProps) {
  if (!isProjectIntakeEnabled()) notFound()
  const { projectId, scanId } = await params
  if (!isUuid(projectId) || !isUuid(scanId)) notFound()

  let results: ScanResults | null
  try {
    results = await getScanResults(projectId, scanId)
  } catch (error) {
    await logWarn({
      message: 'Project intake scan results lookup failed',
      route: '/dashboard/projects/[projectId]/scans/[scanId]',
      context: {
        code:
          error instanceof ScanResultsPersistenceError ? error.code : 'unexpected',
        projectId,
        scanId,
      },
    })
    return <ScanResultsUnavailable />
  }
  if (!results) notFound()
  return <ScanResultsView results={results} />
}
