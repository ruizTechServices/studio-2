import { ProjectIntakeForm } from '@/components/intake/project-intake-form'

export default function ProjectImportPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Import repository
        </h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
          Validate a public GitHub repository identity and create an immutable
          queued scan for future deterministic analysis.
        </p>
      </div>

      <ProjectIntakeForm />
    </div>
  )
}
