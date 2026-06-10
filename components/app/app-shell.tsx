import type { ReactNode } from 'react'

import { AppSidebar } from '@/components/app/app-sidebar'

interface AppShellProps {
  readonly children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-svh overflow-x-hidden bg-muted/30">
      <AppSidebar />
      <div className="min-w-0 lg:pl-64">
        <header className="flex h-16 min-w-0 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6">
          <div>
            <p className="text-sm font-medium">Workspace overview</p>
            <p className="text-xs text-muted-foreground">
              Recover context before changing code.
            </p>
          </div>
          <div className="hidden shrink-0 rounded-lg border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground sm:block">
            No project selected
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
