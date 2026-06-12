import type { SystemMapGroupKey } from '@/lib/intake/system-map/contracts'

const GROUP_LABELS: Readonly<Record<SystemMapGroupKey, string>> = {
  appRoutes: 'App routes',
  pages: 'Pages',
  apiEndpoints: 'API endpoints',
  components: 'Components',
  tests: 'Tests',
  docs: 'Documentation',
  config: 'Configuration',
  assets: 'Assets',
  styles: 'Styles',
  database: 'Database',
  scripts: 'Scripts',
  sourceModules: 'Source modules',
  other: 'Other',
}

export function formatSystemMapGroupLabel(group: SystemMapGroupKey): string {
  return GROUP_LABELS[group]
}
