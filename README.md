# studio-2

A codebase intelligence studio — built for project recovery, system visualization, reusable asset extraction, and work-session continuity.

> Current project status: see [AGENTS.md](./AGENTS.md)

Phase 6 adds deterministic JS/TS/JSX/TSX symbol scanning. Source is parsed only
in bounded worker memory; the database and results UI receive metadata-only
symbol summaries. AI, embeddings, and reusable asset extraction remain deferred.

## Prerequisites

- Node.js 20+
- npm
- A Supabase project (and optionally the Supabase CLI for local migrations)
- A reachable Ollama instance (for the AI endpoints)

## Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Create a `.env.local` file at the project root (never commit this):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never prefix with NEXT_PUBLIC_
PROJECT_INTAKE_ENABLED=true         # local/dev only; production intake always returns 404
GITHUB_TOKEN=                       # optional, rate-limit improvement only
SCAN_WORKER_ID=                     # optional stable worker ID
SCAN_WORKER_LEASE_SECONDS=120
SCAN_WORKER_MAX_ATTEMPTS=3
SCAN_WORKER_POLL_MS=5000
SCAN_WORKER_RETRY_DELAY_SECONDS=60
OLLAMA_GPU_BASE_URL=
OLLAMA_DEFAULT_MODEL=
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=256
OLLAMA_RESERVED_RESPONSE_TOKENS=256
OLLAMA_CHAT_TIMEOUT_MS=120000
```

`SUPABASE_SERVICE_ROLE_KEY` and all Ollama variables are server-only.

## Database Setup

Apply the SQL migrations in `supabase/migrations/` to your Supabase project (e.g. `supabase db push`, or run them in order via the SQL editor). The optional `supabase/sql/enable_logs_retention.sql` script sets up a daily log purge and requires `pg_cron`.

## Scripts

```bash
npm run dev                # Start dev server
npm run build              # Production build
npm run start              # Start production server
npm run lint               # ESLint
npm run test               # Vitest (run once)
npm run test:watch         # Vitest watch mode
npm run test:coverage      # Vitest with coverage report
npm run worker:intake:once # Process at most one eligible scan
npm run worker:intake      # Poll the private scan queue continuously
```

## Deployment

Standard Next.js deployment (`npm run build` + `npm run start`, or a platform like Vercel). Set all environment variables above in the deployment environment. Project intake is automatically disabled in production regardless of `PROJECT_INTAKE_ENABLED`.

## Further Documentation

Usage guides live in `docs/`: `LOGGING.md` (centralized logging), `OLLAMA.md` (stateless local AI endpoints), `PROJECT-INTAKE.md` (intake contract), `INTAKE-WORKER.md` (worker operations), and `VISUAL-ASSETS.md` (brand and animation system).

> Last auto-updated: 2026-06-14
