import type { FileCategory } from '@/lib/intake/archive/contracts'

export const SYSTEM_MAP_GROUP_KEYS = [
  'appRoutes',
  'pages',
  'apiEndpoints',
  'components',
  'tests',
  'docs',
  'config',
  'assets',
  'styles',
  'database',
  'scripts',
  'sourceModules',
  'other',
] as const

export type SystemMapGroupKey = (typeof SYSTEM_MAP_GROUP_KEYS)[number]

export interface SystemMapFileMetadata {
  readonly relativePath: string
  readonly name: string
  readonly extension: string | null
  readonly language: string | null
  readonly category: FileCategory
  readonly sizeBytes: number
  readonly depth: number
  readonly isText: boolean
}

export interface SystemMapGroup {
  readonly count: number
  readonly preview: readonly SystemMapFileMetadata[]
}

export interface SystemMapRootSummary {
  readonly totalFiles: number
  readonly topLevelDirectories: readonly string[]
  readonly detectedFrameworkHints: readonly string[]
  readonly hasAppRouter: boolean
  readonly hasPagesRouter: boolean
  readonly hasApiRoutes: boolean
  readonly hasComponents: boolean
  readonly hasTests: boolean
  readonly hasDocs: boolean
  readonly hasDatabaseMigrations: boolean
  readonly largestFilesMetadataOnly: readonly SystemMapFileMetadata[]
}

export interface SystemMapSeed {
  readonly scanId: string
  readonly projectId: string
  readonly rootSummary: SystemMapRootSummary
  readonly groups: Readonly<Record<SystemMapGroupKey, SystemMapGroup>>
  readonly counts: Readonly<Record<SystemMapGroupKey, number>>
  readonly warnings: readonly string[]
  readonly generatedFrom: 'metadata_only'
}
