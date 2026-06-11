# Intake Worker

Phase 2 adds a private, manually-run, single-concurrency Node worker for durable
scan queue mechanics. The existing `public.scans` table is the queue source,
and immutable lifecycle history is appended to `public.scan_events`.

Phase 2 does not fetch repositories, download or extract archives, parse files,
persist source code, call Ollama, or claim that a source scan completed.

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
8. `complete_scan` exists for a later real processor and emits `completed`, but
   the Phase 2 placeholder never calls it successfully.

The Phase 2 placeholder performs metadata-level validation only, then marks the
scan failed with `phase_3_not_implemented`. This is intentional: a queued scan
proves worker mechanics without pretending repository content was processed.

## Security

- Worker persistence uses fresh service-role clients from `lib/server.ts`.
- Worker RPCs and `scan_events` are unavailable to public, anon, and
  authenticated roles.
- Browser APIs do not expose worker controls or scan events.
- Logs contain scan IDs, worker IDs, attempt counts, and safe error codes only.
- Source contents, secrets, tokens, environment values, archives, and private
  URLs must never be logged or persisted by the worker.

## Next Milestone

Phase 3 adds hostile-input fixtures and bounded GitHub archive intake. It must
enforce redirect allowlisting, download/extraction limits, and archive safety
before deterministic scanning begins.

> Last auto-updated: 2026-06-11
