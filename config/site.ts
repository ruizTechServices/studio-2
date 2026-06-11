export interface SiteNavItem {
  readonly label: string
  readonly href: string
}

export interface SiteConfig {
  readonly name: string
  readonly description: string
  readonly url: string
  readonly mainNav: readonly SiteNavItem[]
}

export const siteConfig = {
  name: 'ruizTechStudio',
  description:
    'A codebase intelligence studio for project recovery, system mapping, reusable asset extraction, and work-session continuity.',
  url: 'https://studio.ruiztechservices.com',
  mainNav: [
    { label: 'Product', href: '/#product' },
    { label: 'Dashboard', href: '/dashboard' },
  ],
} as const satisfies SiteConfig
