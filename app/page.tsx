import {
  ArrowRight,
  Boxes,
  GitPullRequestCreate,
  History,
  Map,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'

import { MarketingFooter } from '@/components/marketing/marketing-footer'
import { MarketingNavbar } from '@/components/marketing/marketing-navbar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const productAreas = [
  {
    title: 'Repo Intake',
    description:
      'Connect a repository and establish a reliable starting point for recovery.',
    icon: GitPullRequestCreate,
  },
  {
    title: 'System Map',
    description:
      'See routes, boundaries, dependencies, and the structure that matters.',
    icon: Map,
  },
  {
    title: 'Reusable Assets',
    description:
      'Identify components, utilities, patterns, and configuration worth keeping.',
    icon: Boxes,
  },
  {
    title: 'Work Sessions',
    description:
      'Preserve decisions and next actions so useful context survives the handoff.',
    icon: History,
  },
] as const

export default function Home() {
  return (
    <div className="min-h-svh">
      <MarketingNavbar />
      <main>
        <section className="border-b">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
                Recover, map, and reuse the codebases you inherit.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                ruizTechStudio rebuilds project context, makes system structure
                visible, extracts reusable assets, and keeps work sessions moving.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className={cn(buttonVariants({ size: 'lg' }), 'rounded-lg')}
                >
                  Open dashboard
                  <ArrowRight data-icon="inline-end" />
                </Link>
                <Link
                  href="/dashboard/import"
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'lg' }),
                    'rounded-lg'
                  )}
                >
                  Import a repository
                </Link>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-muted/30 p-3 shadow-sm">
              <Image
                src="/illustrations/hero-system-recovery.svg"
                width={720}
                height={520}
                priority
                alt="Repository files flowing into a connected system map and reusable asset inventory"
                className="h-auto w-full rounded-lg"
              />
            </div>
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight">
              A focused workflow for understanding existing systems.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Move from an unfamiliar repository to a useful system model without
              turning the workspace into a generic dashboard or full IDE.
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {productAreas.map((area) => (
              <article key={area.title} className="bg-background p-5">
                <area.icon className="size-5 text-blue-700" aria-hidden="true" />
                <h3 className="mt-5 text-sm font-semibold">{area.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {area.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  )
}
