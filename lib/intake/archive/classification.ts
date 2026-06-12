import type { FileCategory } from '@/lib/intake/archive/contracts'

const LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  c: 'C',
  cc: 'C++',
  cpp: 'C++',
  css: 'CSS',
  cxx: 'C++',
  go: 'Go',
  h: 'C',
  hpp: 'C++',
  html: 'HTML',
  java: 'Java',
  js: 'JavaScript',
  json: 'JSON',
  jsx: 'JSX',
  md: 'Markdown',
  markdown: 'Markdown',
  ps1: 'PowerShell',
  py: 'Python',
  rb: 'Ruby',
  rs: 'Rust',
  sh: 'Shell',
  sql: 'SQL',
  toml: 'TOML',
  ts: 'TypeScript',
  tsx: 'TSX',
  yaml: 'YAML',
  yml: 'YAML',
}

const ASSET_EXTENSIONS = new Set([
  'avif',
  'bmp',
  'gif',
  'ico',
  'jpeg',
  'jpg',
  'pdf',
  'png',
  'svg',
  'webp',
  'woff',
  'woff2',
])
const CONFIG_NAMES = new Set([
  '.editorconfig',
  '.eslintrc',
  '.gitignore',
  '.npmrc',
  '.prettierrc',
  'dockerfile',
  'makefile',
  'package.json',
  'tsconfig.json',
  'vitest.config.ts',
])

export function getExtension(name: string): string | null {
  const index = name.lastIndexOf('.')
  return index > 0 && index < name.length - 1
    ? name.slice(index + 1).toLowerCase()
    : null
}

export function getLanguage(extension: string | null): string | null {
  return extension ? LANGUAGE_BY_EXTENSION[extension] ?? null : null
}

export function getCategory(
  relativePath: string,
  name: string,
  extension: string | null,
  language: string | null
): FileCategory {
  const lowerPath = relativePath.toLowerCase()
  const lowerName = name.toLowerCase()
  const segments = lowerPath.split('/')

  if (
    segments.some((segment) =>
      ['test', 'tests', '__tests__', 'spec', 'specs'].includes(segment)
    ) ||
    /(?:^|[._-])(test|spec)\.[^.]+$/.test(lowerName)
  ) {
    return 'test'
  }

  if (
    segments.some((segment) => ['doc', 'docs', 'documentation'].includes(segment)) ||
    extension === 'md' ||
    extension === 'markdown'
  ) {
    return 'docs'
  }

  if (
    CONFIG_NAMES.has(lowerName) ||
    segments.includes('.github') ||
    ['json', 'toml', 'yaml', 'yml'].includes(extension ?? '') ||
    lowerName.endsWith('.config.js') ||
    lowerName.endsWith('.config.ts')
  ) {
    return 'config'
  }

  if (ASSET_EXTENSIONS.has(extension ?? '')) {
    return 'asset'
  }

  return language ? 'source' : 'other'
}
