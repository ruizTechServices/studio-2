# Project Intake

Project intake establishes durable, versioned scan identity and safe processing
boundaries before repository fetching, parsing, system mapping, or AI summaries
are introduced.

## Current Status

Phase 1 intake and Phase 2 private queue/worker mechanics are implemented:

- `/dashboard/import` validates an exact public GitHub repository URL and an
  optional explicit ref.
- `POST /api/projects/import` atomically upserts a project and creates an
  immutable queued scan through a service-role-only database function.
- `GET /api/scans/[scanId]` returns the existing safe scan status shape.
- Both intake routes remain local-only and production-hidden.
- `public.scans` is the private queue source.
- Service-role-only RPCs claim scans, extend leases, schedule retries, mark
  safe terminal failures, and support future completion.
- `public.scan_events` stores immutable claim, heartbeat, retry, failure, and
  completion history.
- The manually-run Node worker preserves single concurrency and supports
  process-once and continuous polling modes.

The Phase 2 processor validates metadata only, then marks the scan failed with
`phase_3_not_implemented`. It does not pretend a repository scan completed.

## Safety Boundary

No submitted URL is fetched. No repository archive is downloaded or extracted.
No source file is parsed. No source code, credentials, tokens, archives,
detected secrets, environment values, private URLs, or AI prompt source text
are persisted or logged.

Worker controls and `scan_events` are not exposed through browser APIs.

## Local Configuration

```env
PROJECT_INTAKE_ENABLED=true
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

SCAN_WORKER_ID=
SCAN_WORKER_LEASE_SECONDS=120
SCAN_WORKER_MAX_ATTEMPTS=3
SCAN_WORKER_POLL_MS=5000
SCAN_WORKER_RETRY_DELAY_SECONDS=60
```

Never expose the service-role key through a `NEXT_PUBLIC_` variable. See
`docs/INTAKE-WORKER.md` for worker ranges, commands, and lifecycle details.

## API Contract

### `POST /api/projects/import`

Input:

```json
{
  "repositoryUrl": "https://github.com/owner/repository",
  "ref": "optional-branch-tag-or-commit"
}
```

Success response:

```json
{
  "projectId": "uuid",
  "scanId": "uuid",
  "status": "queued"
}
```

Only the exact URL format `https://github.com/{owner}/{repository}` is accepted.
Trailing slashes, `.git` suffixes, extra paths, query strings, fragments,
credentials, ports, non-GitHub hosts, and non-HTTPS protocols are rejected.

### `GET /api/scans/[scanId]`

Returns the scan ID, project ID, lifecycle status, statistics, warnings, safe
error, and summary status. The Phase 1 response contract remains unchanged.

## Database Model

Migrations:

- `supabase/migrations/20260610214115_create_project_intake_foundation.sql`
- `supabase/migrations/20260610233821_restrict_phase_1_service_role_grants.sql`
- `supabase/migrations/20260611000000_create_scan_worker_foundation.sql`

`public.projects` stores normalized public GitHub repository identity.
`public.scans` stores immutable scan identity, queue status, attempts, retry
schedule, lease health, policy limits, safe results, and timestamps.
`public.scan_events` stores durable worker lifecycle history.

RLS is enabled on all three tables. Public, anon, and authenticated access is
revoked. Worker RPCs use row ownership checks and are executable only by
`service_role`. Claims use `FOR UPDATE SKIP LOCKED` to prevent double claims.

## Status And Event Flow

An imported scan begins as `queued` and emits `queued`. A worker claim changes
it to `validating`, increments `attempt_count`, creates a lease, and emits
`claimed`. Heartbeats extend an owned lease and emit `heartbeat`.

Retryable failures with attempts remaining return to `queued`, set
`next_attempt_at`, and emit `retry_scheduled`. Non-retryable or exhausted work
becomes `failed` with safe error fields and emits `failed`. Future real
processors may use `completed` or `completed_with_warnings` through the
completion RPC.

The Phase 2 placeholder always ends as `failed` with
`phase_3_not_implemented`.

## Intake Policy Limits

| Limit | Value |
|---|---:|
| Compressed download | 100 MiB |
| Extracted content | 250 MiB |
| Archive entries | 20,000 |
| Parsed text file | 2 MiB |
| Path length | 512 characters |
| Directory depth | 35 |
| Scan duration | 10 minutes |
| Symbols | 100,000 |
| Relationships | 200,000 |
| Concurrent scans per worker | 1 |

These limits are persisted with every scan so future processing remains
explainable and reproducible.

## Worker Commands

```bash
npm run worker:intake:once
npm run worker:intake
```

The worker never starts automatically with `npm run dev` and handles SIGINT and
SIGTERM after the current single item finishes.

## Deferred Phases

1. **Phase 3 safe GitHub archive intake:** hostile-input fixtures, internally
   constructed GitHub URLs, redirect allowlisting, bounded download/extraction,
   archive defenses, and file inventory without source persistence.
2. **JavaScript and TypeScript scanner:** deterministic TypeScript compiler API
   evidence for files, imports, exports, declarations, routes, APIs, and local
   relationships.
3. **Ollama summary:** factual summary generated only from persisted,
   deterministic findings.
4. **Python and Go adapters:** parser adapters added only after JS/TS scanning
   is stable.

## Operations

Keep local and remote migration history aligned through the Supabase CLI and
run security/performance advisors after every schema change. Live Supabase and
GitHub network smoke tests remain outside normal PR CI.

> Last auto-updated: 2026-06-11
