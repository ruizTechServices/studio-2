import {
  ArrowRight,
  Boxes,
  CircleDashed,
  FileSearch,
  GitBranch,
  History,
  Map,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const overviewCards = [
  {
    title: 'Current Project Status',
    description:
      'A project status summary will appear after a repository scan.',
    icon: FileSearch,
  },
  {
    title: 'System Map Summary',
    description:
      'Review boundaries, routes, dependencies, and key system relationships.',
    icon: Map,
  },
  {
    title: 'Reusable Assets',
    description:
      'Extract useful components, utilities, patterns, and configuration.',
    icon: Boxes,
  },
  {
    title: 'Work Session Memory',
    description:
      'Preserve decisions, open questions, and the next useful action.',
    icon: History,
  },
] as const

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rebuild project context, understand the system, and continue useful work.
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
              <GitBranch className="size-4" aria-hidden="true" />
              Pick up where you left off
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              Start by connecting a repository
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Import a codebase to create a scan, system map, current-status
              summary, and reusable asset inventory.
            </p>
          </div>
          <Link
            href="/dashboard/import"
            className={cn(buttonVariants({ size: 'lg' }), 'rounded-lg')}
          >
            Import repository
            <ArrowRight data-icon="inline-end" />
          </Link>
        </div>
        <div className="grid border-t bg-muted/30 sm:grid-cols-3">
          {['Connect repository', 'Scan structure', 'Review system model'].map(
            (step, index) => (
              <div
                key={step}
                className="flex items-center gap-3 border-b px-5 py-3 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
              >
                <span className="flex size-6 items-center justify-center rounded-full border bg-background text-xs font-medium">
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {step}
                </span>
              </div>
            )
          )}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {overviewCards.map((card) => (
          <article key={card.title} className="rounded-xl border bg-card p-5">
            <card.icon className="size-5 text-blue-700" aria-hidden="true" />
            <h2 className="mt-4 text-sm font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {card.description}
            </p>
            <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
              <CircleDashed className="size-3.5" aria-hidden="true" />
              Waiting for project intake
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold">Recent Activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            User-facing project events will appear here.
          </p>
          <div className="mt-5 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
            <History className="mx-auto size-5 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">No activity yet</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              This timeline is separate from diagnostic infrastructure logs.
            </p>
          </div>
        </article>

        <article className="rounded-xl border bg-card p-5">
          <ShieldCheck className="size-5 text-blue-700" aria-hidden="true" />
          <h2 className="mt-4 text-sm font-semibold">Project Health</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Health signals will be based on verified scan results, not invented
            dashboard metrics.
          </p>
          <div className="mt-5 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            Tip: begin with one repository and confirm its system boundaries
            before extracting reusable assets.
          </div>
        </article>
      </section>
    </div>
  )
}
