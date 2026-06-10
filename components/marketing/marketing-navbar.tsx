import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

export function MarketingNavbar() {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          {siteConfig.name}
        </Link>
        <div className="flex items-center gap-2 sm:gap-5">
          <nav aria-label="Main navigation" className="hidden items-center gap-5 sm:flex">
            {siteConfig.mainNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ size: 'sm' }), 'rounded-lg')}
          >
            Open dashboard
          </Link>
        </div>
      </div>
    </header>
  )
}
