# Intake Worker

The private, manually-run, single-concurrency Node worker combines durable
queue mechanics with Phase 3 safe public GitHub archive intake. It inventories
file metadata without persisting or extracting source files.

## Run Commands

```bash
npm run worker:intake:once  # Claim and process at most one eligible scan
npm run worker:intake       # Poll continuously until SIGINT or SIGTERM
```

The worker is not started by `npm run dev`. `tsx` is a development dependency
used only to run the TypeScript worker entry point directly.

## Environment

The worker loads `.env.local` through Next.js environment loading and requires
the existing server-only Supabase variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GITHUB_TOKEN= # optional; never enables private repository intake
```

Optional worker settings:

```env
SCAN_WORKER_ID=                    # generated safely when omitted
SCAN_WORKER_LEASE_SECONDS=120      # accepted range: 15-3600
SCAN_WORKER_MAX_ATTEMPTS=3         # accepted range: 1-20
SCAN_WORKER_POLL_MS=5000           # accepted range: 100-300000
SCAN_WORKER_RETRY_DELAY_SECONDS=60 # accepted range: 1-86400
```

Invalid or out-of-range settings fall back to safe defaults. Worker
concurrency is fixed at one.

## Queue And Event Flow

1. Project intake creates the scan and emits a `queued` event.
2. `claim_next_scan` claims one due queued scan or one scan with an expired
   active lease using `FOR UPDATE SKIP LOCKED`.
3. The claim increments `attempt_count`, sets the scan to `validating`, records
   worker/lease/heartbeat timestamps, and emits a `claimed` event.
4. `heartbeat_scan` extends a currently owned, unexpired lease and emits a
   `heartbeat` event.
5. Retryable failures with remaining attempts return to `queued`, receive
   `next_attempt_at`, and emit `retry_scheduled`.
6. Terminal failures become `failed` with safe error fields and emit `failed`.
7. Expired active scans that exhausted their attempt budget are marked
   `failed` by the next claim operation.
8. Phase 3 resolves an immutable public GitHub commit, downloads a bounded
   archive, stream-validates it, and writes inventory in lease-checked batches.
9. Atomic finalization verifies the expected inventory count before emitting
   `completed` or `completed_with_warnings`.

## Security

- Worker persistence uses fresh service-role clients from `lib/server.ts`.
- Worker RPCs and `scan_events` are unavailable to public, anon, and
  authenticated roles.
- Browser APIs do not expose worker controls or scan events.
- Logs contain scan IDs, worker IDs, attempt counts, and safe error codes only.
- Source contents, secrets, tokens, environment values, archives, paths,
  filenames, and private URLs must never be logged by the worker.
- Source contents and archives are never persisted. Repository-relative paths
  are persisted only as private inventory metadata.

## Supported Source References

Phase 3 supports blank refs resolved through the default branch, named
branches, and full 40-character commit SHAs. Tags and private repositories are
rejected without calling GitHub tag endpoints.

## Next Milestone

Add deterministic JavaScript and TypeScript scanning without weakening the
Phase 3 metadata-only persistence boundary.

> Last auto-updated: 2026-06-12
