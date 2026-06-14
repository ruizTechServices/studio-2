import {
  SYSTEM_MAP_GROUP_KEYS,
  type SystemMapFileMetadata,
  type SystemMapGroupKey,
  type SystemMapSeed,
} from '@/lib/intake/system-map/contracts'
import { classifySystemMapFile } from '@/lib/intake/system-map/classifiers'

const GROUP_PREVIEW_LIMIT = 5
const LARGEST_FILES_LIMIT = 5

function detectFrameworkHints(files: readonly SystemMapFileMetadata[]): readonly string[] {
  const paths = files.map((file) => file.relativePath.toLowerCase())
  const extensions = new Set(files.map((file) => file.extension?.toLowerCase()))
  const hints = new Set<string>()

  if (paths.some((path) => /^next\.config\.[^.]+$/.test(path) || /^app\/(?:.+\/)?page\.(?:ts|tsx)$/.test(path))) hints.add('Next.js')
  if (extensions.has('jsx') || extensions.has('tsx')) hints.add('React')
  if (paths.some((path) => path === 'tsconfig.json') || extensions.has('ts') || extensions.has('tsx')) hints.add('TypeScript')
  if (paths.some((path) => path.startsWith('supabase/'))) hints.add('Supabase')
  if (paths.some((path) => /^tailwind\.config\.[^.]+$/.test(path))) hints.add('Tailwind CSS')
  if (paths.some((path) => /^vitest\.config\.[^.]+$/.test(path))) hints.add('Vitest')

  return [...hints].sort((left, right) => left.localeCompare(right))
}

export function buildSystemMapSeed(
  scanId: string,
  projectId: string,
  input: readonly SystemMapFileMetadata[]
): SystemMapSeed {
  const files = [...input].sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath)
  )
  const grouped = Object.fromEntries(
    SYSTEM_MAP_GROUP_KEYS.map((key) => [key, [] as SystemMapFileMetadata[]])
  ) as Record<SystemMapGroupKey, SystemMapFileMetadata[]>

  for (const file of files) grouped[classifySystemMapFile(file)].push(file)

  const counts = Object.fromEntries(
    SYSTEM_MAP_GROUP_KEYS.map((key) => [key, grouped[key].length])
  ) as Record<SystemMapGroupKey, number>
  const groups = Object.fromEntries(
    SYSTEM_MAP_GROUP_KEYS.map((key) => [
      key,
      { count: counts[key], preview: grouped[key].slice(0, GROUP_PREVIEW_LIMIT) },
    ])
  ) as unknown as SystemMapSeed['groups']
  const topLevelDirectories = [
    ...new Set(
      files
        .map((file) => file.relativePath.split('/'))
        .filter((segments) => segments.length > 1)
        .map(([directory]) => directory)
    ),
  ].sort((left, right) => left.localeCompare(right))
  const largestFilesMetadataOnly = [...files]
    .sort((left, right) =>
      right.sizeBytes === left.sizeBytes
        ? left.relativePath.localeCompare(right.relativePath)
        : right.sizeBytes - left.sizeBytes
    )
    .slice(0, LARGEST_FILES_LIMIT)

  return {
    scanId,
    projectId,
    rootSummary: {
      totalFiles: files.length,
      topLevelDirectories,
      detectedFrameworkHints: detectFrameworkHints(files),
      hasAppRouter: counts.appRoutes > 0,
      hasPagesRouter: counts.pages > 0,
      hasApiRoutes: counts.apiEndpoints > 0,
      hasComponents: counts.components > 0,
      hasTests: counts.tests > 0,
      hasDocs: counts.docs > 0,
      hasDatabaseMigrations: grouped.database.some((file) =>
        file.relativePath.toLowerCase().includes('migration')
      ),
      largestFilesMetadataOnly,
    },
    groups,
    counts,
    warnings: files.length === 0 ? ['No file metadata was available for the system overview.'] : [],
    generatedFrom: 'metadata_only',
  }
}
