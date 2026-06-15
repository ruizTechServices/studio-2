import type { ScanFileInventory } from '@/lib/intake/archive/contracts'
import type {
  ReusableAssetCandidate,
  ReusableAssetKind,
  ReusableAssetSymbolKind,
} from '@/lib/intake/reusable-assets/contracts'
import type { ScanSymbol, SymbolConfidence } from '@/lib/intake/symbols/contracts'

export const REUSABLE_ASSET_CANDIDATE_MAX = 5_000

const TEST_GLOBALS = new Set([
  'afterAll', 'afterEach', 'beforeAll', 'beforeEach', 'describe', 'expect',
  'it', 'jest', 'test', 'vi',
])
const GENERATED_PATH = /(?:^|\/)(?:node_modules|coverage|dist|build|out|output|generated|\.next)(?:\/|$)/
const TEST_PATH = /(?:^|\/)(?:__tests__|tests?|specs?)(?:\/|$)|\.(?:test|spec)\.[jt]sx?$/
const USEFUL_PATH = /(?:^|\/)(?:components?|hooks?|lib|utils?|utilities|helpers?|services?|contracts?|types?|schemas?|validators?|models?|config|constants?|policy|limits|intake|parser|scanner|classifier|analyzer)(?:\/|$)/
const ALGORITHM_PATH = /(?:^|\/)(?:intake|parser|scanner|classifier|analyzer|repository-intelligence)(?:\/|$)/
const CONFIG_PATH = /(?:^|\/)(?:config|constants?|env|policy|limits)(?:\/|$)/
const TYPE_PATH = /(?:^|\/)(?:contracts?|types?|schemas?|validators?|models?)(?:\/|$)/
const UTILITY_PATH = /(?:^|\/)(?:lib|utils?|utilities|helpers?|services?)(?:\/|$)/

function confidence(score: number): SymbolConfidence {
  if (score >= 85) return 'high'
  if (score >= 65) return 'medium'
  return 'low'
}

function assetKind(symbol: ScanSymbol, path: string): ReusableAssetKind {
  if (symbol.kind === 'component') return 'ui_component'
  if (symbol.kind === 'hook') return 'hook'
  if (symbol.kind === 'api_handler') return 'api_handler'
  if (symbol.kind === 'type') return 'type_definition'
  if (symbol.kind === 'constant') return CONFIG_PATH.test(path) ? 'config_helper' : 'constant'
  if (symbol.kind === 'function') return 'utility'
  return 'unknown'
}

function scoreSymbol(symbol: ScanSymbol, file: ScanFileInventory): {
  score: number
  reasons: readonly string[]
} | null {
  const path = file.relativePath.toLowerCase()
  if (
    symbol.kind === 'import' ||
    symbol.kind === 'export' ||
    TEST_GLOBALS.has(symbol.name) ||
    TEST_PATH.test(path) ||
    file.category === 'test' ||
    GENERATED_PATH.test(path)
  ) return null

  let score = 0
  const reasons: string[] = []
  if (symbol.exported) {
    score += 35
    reasons.push('Exported declaration')
  } else {
    score -= 25
  }

  const kindScores: Readonly<Partial<Record<ReusableAssetSymbolKind, number>>> = {
    component: 35,
    hook: 35,
    api_handler: 30,
    function: 22,
    type: 22,
    constant: 18,
    unknown: -30,
  }
  score += kindScores[symbol.kind as ReusableAssetSymbolKind] ?? -30

  if (symbol.kind === 'component' && /\.(?:jsx|tsx)$/.test(path)) {
    score += 15
    reasons.push('Reusable UI component')
  } else if (symbol.kind === 'hook' && /^use[A-Z0-9]/.test(symbol.name)) {
    score += 15
    reasons.push('Reusable hook convention')
  } else if (symbol.kind === 'api_handler' && /(?:^|\/)app\/api\/|route\.[jt]sx?$/.test(path)) {
    score += 15
    reasons.push('API route handler')
  } else if (symbol.kind === 'function' && UTILITY_PATH.test(path)) {
    score += 15
    reasons.push('Utility-oriented path')
  } else if (symbol.kind === 'type' && TYPE_PATH.test(path)) {
    score += 15
    reasons.push('Shared type-oriented path')
  } else if (symbol.kind === 'constant' && CONFIG_PATH.test(path)) {
    score += 15
    reasons.push('Configuration-oriented path')
  }

  if (ALGORITHM_PATH.test(path) && ['function', 'type', 'constant'].includes(symbol.kind)) {
    score += 15
    reasons.push('Repository intelligence logic')
  } else if (USEFUL_PATH.test(path)) {
    score += 8
    reasons.push('Reusable module path')
  }

  if (!symbol.exported && !ALGORITHM_PATH.test(path)) return null
  if (score < 50) return null
  return { score: Math.min(score, 100), reasons: reasons.slice(0, 3) }
}

export function buildReusableAssetCandidates(
  scanId: string,
  projectId: string,
  files: readonly ScanFileInventory[],
  symbols: readonly ScanSymbol[],
  limit = REUSABLE_ASSET_CANDIDATE_MAX
): readonly ReusableAssetCandidate[] {
  const filesByPath = new Map(files.map((file) => [file.relativePath, file]))
  const candidates: ReusableAssetCandidate[] = []

  for (const symbol of symbols) {
    const file = filesByPath.get(symbol.relativePath)
    if (!file) continue
    const scored = scoreSymbol(symbol, file)
    if (!scored) continue
    candidates.push({
      scanId,
      projectId,
      relativePath: symbol.relativePath,
      symbolName: symbol.name,
      symbolKind: symbol.kind as ReusableAssetSymbolKind,
      assetKind: assetKind(symbol, file.relativePath.toLowerCase()),
      exported: symbol.exported,
      confidence: confidence(scored.score),
      reuseScore: scored.score,
      reasons: scored.reasons,
    })
  }

  return candidates
    .sort((a, b) =>
      b.reuseScore - a.reuseScore ||
      ({ high: 0, medium: 1, low: 2 }[a.confidence] -
        { high: 0, medium: 1, low: 2 }[b.confidence]) ||
      a.relativePath.localeCompare(b.relativePath) ||
      a.symbolName.localeCompare(b.symbolName)
    )
    .slice(0, Math.max(0, Math.min(limit, REUSABLE_ASSET_CANDIDATE_MAX)))
}
