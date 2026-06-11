'use client'

import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  RefreshCw,
} from 'lucide-react'
import Image from 'next/image'
import { FormEvent, useEffect, useRef, useState } from 'react'

import {
  ProjectAnalysisLoader,
  RepoScanAnimation,
} from '@/components/animations'
import { Button } from '@/components/ui/button'
import type {
  IntakeApiError,
  IntakeField,
  ProjectImportResponse,
  ScanStatusResponse,
} from '@/lib/intake/contracts'
import {
  isScanStatus,
  isSummaryStatus,
  isTerminalScanStatus,
} from '@/lib/intake/policy'
import {
  validateGitHubRepositoryUrl,
  validateGitRef,
} from '@/lib/intake/validation'

type FieldErrors = Partial<Record<IntakeField, string>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isApiError(value: unknown): value is IntakeApiError {
  return isRecord(value) && typeof value.error === 'string'
}

function isProjectImportResponse(value: unknown): value is ProjectImportResponse {
  return (
    isRecord(value) &&
    typeof value.projectId === 'string' &&
    typeof value.scanId === 'string' &&
    value.status === 'queued'
  )
}

function isScanStatusResponse(value: unknown): value is ScanStatusResponse {
  return (
    isRecord(value) &&
    typeof value.scanId === 'string' &&
    typeof value.projectId === 'string' &&
    isScanStatus(value.status) &&
    isRecord(value.statistics) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === 'string') &&
    (value.safeError === null || typeof value.safeError === 'string') &&
    isSummaryStatus(value.summaryStatus)
  )
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function inputClassName(hasError: boolean): string {
  return [
    'mt-2 h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none transition',
    'placeholder:text-muted-foreground focus:border-ring focus:ring-3 focus:ring-ring/20',
    hasError
      ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
      : 'border-input',
  ].join(' ')
}

export function ProjectIntakeForm() {
  const [repositoryUrl, setRepositoryUrl] = useState('')
  const [ref, setRef] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [requestError, setRequestError] = useState<string | null>(null)
  const [scan, setScan] = useState<ScanStatusResponse | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submitControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => submitControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!scan || isTerminalScanStatus(scan.status)) {
      return
    }

    let isActive = true
    let isPolling = false
    let pollController: AbortController | null = null

    const poll = async () => {
      if (document.visibilityState !== 'visible' || isPolling) {
        return
      }

      isPolling = true
      pollController = new AbortController()

      try {
        const response = await fetch(`/api/scans/${scan.scanId}`, {
          cache: 'no-store',
          signal: pollController.signal,
        })
        const payload = await readJson(response)

        if (!response.ok || !isScanStatusResponse(payload)) {
          if (isActive) {
            setRequestError(
              isApiError(payload) ? payload.error : 'Unable to refresh scan status.'
            )
          }
          return
        }

        if (isActive) {
          setScan(payload)
          setRequestError(null)
        }
      } catch (error) {
        if (isActive && !(error instanceof DOMException && error.name === 'AbortError')) {
          setRequestError('Unable to refresh scan status.')
        }
      } finally {
        isPolling = false
      }
    }

    const intervalId = window.setInterval(poll, 2_000)

    return () => {
      isActive = false
      window.clearInterval(intervalId)
      pollController?.abort()
    }
  }, [scan])

  function validateFields(): boolean {
    const nextErrors: FieldErrors = {}
    const repositoryValidation = validateGitHubRepositoryUrl(repositoryUrl)
    const refValidation = validateGitRef(ref)

    if (!repositoryValidation.ok) {
      nextErrors.repositoryUrl = repositoryValidation.error
    }

    if (!refValidation.ok) {
      nextErrors.ref = refValidation.error
    }

    setFieldErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setRequestError(null)

    if (!validateFields()) {
      return
    }

    submitControllerRef.current?.abort()
    const controller = new AbortController()
    submitControllerRef.current = controller
    setIsSubmitting(true)
    setScan(null)

    try {
      const response = await fetch('/api/projects/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          repositoryUrl,
          ...(ref ? { ref } : {}),
        }),
        signal: controller.signal,
      })
      const payload = await readJson(response)

      if (!response.ok || !isProjectImportResponse(payload)) {
        if (isApiError(payload)) {
          setRequestError(payload.error)
          if (payload.field) {
            setFieldErrors((current) => ({
              ...current,
              [payload.field as IntakeField]: payload.error,
            }))
          }
        } else {
          setRequestError('Unable to create a repository scan.')
        }
        return
      }

      setScan({
        scanId: payload.scanId,
        projectId: payload.projectId,
        status: payload.status,
        statistics: {},
        warnings: [],
        safeError: null,
        summaryStatus: 'not_started',
      })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setRequestError('Unable to create a repository scan.')
      }
    } finally {
      if (submitControllerRef.current === controller) {
        setIsSubmitting(false)
        submitControllerRef.current = null
      }
    }
  }

  const isTerminal = scan ? isTerminalScanStatus(scan.status) : false

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-xl border bg-card p-5 sm:p-6"
        >
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <GitBranch className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">Public GitHub repository</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Phase 1 creates a durable queued scan. It does not fetch or inspect
                source code yet.
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label htmlFor="repository-url" className="text-sm font-medium">
              Repository URL
            </label>
            <input
              id="repository-url"
              name="repositoryUrl"
              type="url"
              value={repositoryUrl}
              onChange={(event) => {
                setRepositoryUrl(event.target.value)
                setFieldErrors((current) => ({
                  ...current,
                  repositoryUrl: undefined,
                }))
              }}
              onBlur={validateFields}
              placeholder="https://github.com/owner/repository"
              autoComplete="url"
              aria-invalid={Boolean(fieldErrors.repositoryUrl)}
              aria-describedby={
                fieldErrors.repositoryUrl ? 'repository-url-error' : undefined
              }
              className={inputClassName(Boolean(fieldErrors.repositoryUrl))}
            />
            {fieldErrors.repositoryUrl ? (
              <p
                id="repository-url-error"
                className="mt-2 text-xs text-destructive"
              >
                {fieldErrors.repositoryUrl}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Exact format only. Private repositories and other hosts are not
                supported.
              </p>
            )}
          </div>

          <div className="mt-5">
            <label htmlFor="repository-ref" className="text-sm font-medium">
              Explicit ref <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              id="repository-ref"
              name="ref"
              type="text"
              value={ref}
              onChange={(event) => {
                setRef(event.target.value)
                setFieldErrors((current) => ({ ...current, ref: undefined }))
              }}
              placeholder="main, tag, or commit SHA"
              spellCheck={false}
              aria-invalid={Boolean(fieldErrors.ref)}
              aria-describedby={fieldErrors.ref ? 'repository-ref-error' : undefined}
              className={inputClassName(Boolean(fieldErrors.ref))}
            />
            {fieldErrors.ref ? (
              <p
                id="repository-ref-error"
                className="mt-2 text-xs text-destructive"
              >
                {fieldErrors.ref}
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Leave blank to resolve the default branch in a future intake phase.
              </p>
            )}
          </div>

          {requestError ? (
            <div
              role="alert"
              className="mt-5 flex gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs leading-5 text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {requestError}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Creating scan...' : 'Create queued scan'}
            </Button>
            {isSubmitting ? (
              <ProjectAnalysisLoader label="Validating intake request" />
            ) : null}
          </div>
        </form>

        <aside className="rounded-xl border bg-card p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Intake trust boundary</h2>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Submitted URLs are validated into owner, repository, and ref values.
            The application never fetches the submitted URL directly.
          </p>
          <Image
            src="/illustrations/repo-import.svg"
            alt="A validated repository address becoming a structured project scan"
            width={480}
            height={300}
            className="mt-5 h-auto w-full rounded-lg"
          />
        </aside>
      </section>

      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Scan status</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Queued scans remain waiting until the Phase 2 private worker is
              implemented.
            </p>
          </div>
          {scan ? (
            <span className="rounded-full border bg-muted/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
              {scan.status}
            </span>
          ) : null}
        </div>

        {scan ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]">
            <div className="rounded-lg border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                {isTerminal ? (
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-blue-700"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCw
                    className="mt-0.5 size-5 shrink-0 text-blue-700"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <p className="text-sm font-medium">
                    {isTerminal
                      ? 'Scan reached a terminal state'
                      : 'Queued for future processing'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Scan <span className="font-mono">{scan.scanId}</span>
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Project <span className="font-mono">{scan.projectId}</span>
                  </p>
                  {scan.safeError ? (
                    <p className="mt-3 text-xs text-destructive">
                      {scan.safeError}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <RepoScanAnimation decorative />
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center">
            <GitBranch
              className="mx-auto size-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium">No intake scan created</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Submit an exact public GitHub repository URL to create the first
              durable queued scan.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
