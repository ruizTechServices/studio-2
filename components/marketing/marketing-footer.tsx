import Link from 'next/link'

import { BrandLogo } from '@/components/brand/brand-logo'
import { siteConfig } from '@/config/site'

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo compact />
          <p>{siteConfig.name} | Codebase intelligence for work in progress.</p>
        </div>
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          Open dashboard
        </Link>
      </div>
    </footer>
  )
}
