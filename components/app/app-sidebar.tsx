'use client'

import {
  Boxes,
  FolderGit2,
  GitPullRequestCreate,
  History,
  LayoutDashboard,
  Map,
  Settings,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { BrandLogo } from '@/components/brand/brand-logo'
import { dashboardNavigation } from '@/config/navigation'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

const navigationIcons = {
  Overview: LayoutDashboard,
  Projects: FolderGit2,
  'Import Repo': GitPullRequestCreate,
  'System Map': Map,
  'Reusable Assets': Boxes,
  'Work Sessions': History,
  Settings,
} as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="min-w-0 max-w-full border-b bg-sidebar lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:border-r lg:border-b-0">
      <div className="flex h-full min-w-0 flex-col">
        <div className="flex h-16 items-center border-b px-4 lg:px-5">
          <Link href="/" aria-label={`${siteConfig.name} home`}>
            <BrandLogo />
          </Link>
        </div>
        <nav
          aria-label="Dashboard navigation"
          className="flex min-w-0 max-w-full gap-1 overflow-x-auto p-2 lg:flex-1 lg:flex-col lg:overflow-visible lg:p-3"
        >
          {dashboardNavigation.map((item) => {
            const Icon = navigationIcons[item.label]
            const isActive =
              item.href === '/dashboard'
                ? pathname === item.href
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="hidden border-t p-4 lg:block">
          <p className="text-xs font-medium text-sidebar-foreground">
            v0 workspace
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Import a repository to begin building its system model.
          </p>
        </div>
      </div>
    </aside>
  )
}
