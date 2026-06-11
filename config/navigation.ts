export interface NavigationItem {
  readonly label: string
  readonly href: string
}

export const dashboardNavigation = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Projects', href: '/dashboard/projects' },
  { label: 'Import Repo', href: '/dashboard/import' },
  { label: 'System Map', href: '/dashboard/system-map' },
  { label: 'Reusable Assets', href: '/dashboard/reusable-assets' },
  { label: 'Work Sessions', href: '/dashboard/work-sessions' },
  { label: 'Settings', href: '/dashboard/settings' },
] as const satisfies readonly NavigationItem[]
