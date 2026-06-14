import type {
  SystemMapFileMetadata,
  SystemMapGroupKey,
} from '@/lib/intake/system-map/contracts'

function hasSegment(path: string, segment: string): boolean {
  return path === segment || path.startsWith(`${segment}/`) || path.includes(`/${segment}/`)
}

function matchesFile(path: string, pattern: RegExp): boolean {
  return pattern.test(path.split('/').at(-1) ?? '')
}

export function classifySystemMapFile(file: SystemMapFileMetadata): SystemMapGroupKey {
  const path = file.relativePath.toLowerCase()
  const extension = file.extension?.toLowerCase() ?? ''

  if (/^app\/(?:.+\/)?route\.(?:ts|tsx|js|jsx)$/.test(path)) return 'apiEndpoints'
  if (/^app\/(?:.+\/)?(?:page|layout)\.(?:ts|tsx)$/.test(path)) return 'appRoutes'
  if (hasSegment(path, 'pages')) return 'pages'
  if (
    matchesFile(path, /\.(?:test|spec)\.[^.]+$/) ||
    hasSegment(path, '__tests__') ||
    hasSegment(path, 'test') ||
    hasSegment(path, 'tests')
  ) {
    return 'tests'
  }
  if (hasSegment(path, 'components')) return 'components'
  if (
    hasSegment(path, 'supabase') ||
    hasSegment(path, 'migrations') ||
    hasSegment(path, 'prisma') ||
    extension === 'sql'
  ) {
    return 'database'
  }
  if (
    /^(?:package\.json|tsconfig(?:\..+)?\.json|next\.config\.[^.]+|eslint\.config\.[^.]+|postcss\.config\.[^.]+|tailwind\.config\.[^.]+|vitest\.config\.[^.]+|playwright\.config\.[^.]+|\.env\.example)$/.test(
      path
    )
  ) {
    return 'config'
  }
  if (hasSegment(path, 'docs') || matchesFile(path, /^readme/i) || ['md', 'mdx'].includes(extension)) {
    return 'docs'
  }
  if (
    hasSegment(path, 'public') ||
    ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'woff', 'woff2', 'ttf', 'otf', 'mp3', 'mp4', 'webm'].includes(extension)
  ) {
    return 'assets'
  }
  if (['css', 'scss', 'sass', 'less'].includes(extension)) return 'styles'
  if (hasSegment(path, 'scripts') || ['sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1'].includes(extension)) {
    return 'scripts'
  }
  if (['lib', 'src', 'utils', 'hooks', 'services', 'server'].some((segment) => hasSegment(path, segment))) {
    return 'sourceModules'
  }
  return 'other'
}
