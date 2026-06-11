# Project Intake

Project intake is the first real ruizTechStudio feature. It establishes durable,
versioned scan identity before repository fetching, parsing, system mapping, or
AI summaries are introduced.

## Phase 1 Status

Phase 1 is implemented as a local-development-only intake skeleton:

- `/dashboard/import` validates an exact public GitHub repository URL and an
  optional explicit ref.
- `POST /api/projects/import` atomically upserts a project and creates an
  immutable queued scan through a service-role-only database function.
- `GET /api/scans/[scanId]` returns a safe scan status shape.
- Both intake routes return `404` unless `PROJECT_INTAKE_ENABLED=true`.
- Both intake routes always return `404` in production until authorization
  exists.
- No submitted URL is fetched. No source code, credentials, tokens, archives,
  detected secrets, or AI prompt source text are persisted or logged.

Queued scans intentionally remain queued until the private Phase 2 worker is
implemented.

## Local Configuration

Add this server-side flag to `.env.local`:

```env
PROJECT_INTAKE_ENABLED=true
```

The existing Supabase server variables are also required:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Never expose the service-role key through a `NEXT_PUBLIC_` variable.

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
error, and summary status. It never returns infrastructure errors or source
content.

## Phase 1 Database Model

Migration:

`supabase/migrations/20260610214115_create_project_intake_foundation.sql`

- `public.projects` stores normalized public GitHub repository identity.
- `public.scans` stores immutable scan identity, requested source ref, lifecycle
  state, future worker lease fields, policy-limit snapshot, safe results, and
  timestamps.
- `public.create_project_scan(...)` performs the project upsert and queued-scan
  insert in one transaction.
- RLS is enabled on both tables.
- Public, anon, and authenticated access is revoked.
- Only `service_role` receives the minimum Phase 1 table and function grants.

The authoritative Supabase project `lyclwqvmbhiwlxffcnbw` is linked and the
Phase 1 migrations are applied. A follow-up migration explicitly narrows
`service_role` table privileges because Supabase default privileges initially
granted broader access than Phase 1 requires. Remote security advisors,
performance advisors, and schema lint report no issues.

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

## Deferred Phases

1. **Queue and worker:** private Supabase Queue, one-message worker claims,
   leases, attempts, retries, durable events, and cleanup.
2. **Safe GitHub archive intake:** internally constructed GitHub URLs, redirect
   allowlisting, bounded download/extraction, hostile archive defenses, and file
   inventory without source persistence.
3. **JavaScript and TypeScript scanner:** deterministic TypeScript compiler API
   evidence for files, imports, exports, declarations, routes, APIs, and local
   relationships.
4. **Ollama summary:** factual summary generated only from persisted,
   deterministic findings.
5. **Python and Go adapters:** parser adapters added only after JS/TS scanning is
   stable.

## Operational Next Steps

1. Keep local and remote migration history aligned through the Supabase CLI.
2. Run Supabase security and performance advisors after every schema change.
3. Add `PROJECT_INTAKE_ENABLED=true` to `.env.local` when exercising intake
   locally. Production intake remains hidden regardless of this value.
4. Begin Phase 2 only after its queue and worker security contract is reviewed.

Live Supabase and GitHub network smoke tests should remain outside normal PR CI.
Normal CI should run lint, strict TypeScript, unit tests, and the production
build.
