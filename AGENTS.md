<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# studio-2 — Agent Context

This is a **codebase intelligence studio** — not a generic SaaS app. The product goal is project recovery, system visualization, reusable asset extraction, and work-session continuity. It is a clean Next.js rebuild of `ruizTechStudio` with intentional architecture.

## Current State (as of 2026-06-12)

Branch: `codex/phase-4-scan-results-view` (on top of merged Phase 3). The v0 app shell, Ollama integration, marketing surface, visual asset foundation, Phase 3 safe GitHub archive intake, and Phase 4 deterministic scan results view are complete and locally verified (232 tests passing, ~90% statement coverage). Deterministic source scanning has not started. The Phase 4 migration and read RPC are locally verified but **not yet applied to the linked Supabase project**.

Completed since initial scaffold:
- `lib/logger/` — full logging module (types, sanitizer, validator, server writer, client poster)
- `app/api/log/route.ts` — POST /api/log client-side log ingestion
- `supabase/migrations/20260609000000_create_logs.sql` — `public.logs` table with RLS
- `lib/ai/` — stateless Ollama AI module: chat contract, context builder, token budget, model policy, ollama client, conversation summary, model config
- `app/api/ai/chat/route.ts` — POST /api/ai/chat — stateless, token-budgeted Ollama chat
- `app/api/ai/health/route.ts` — GET /api/ai/health — Ollama reachability probe
- `components/app/app-shell.tsx` + `app-sidebar.tsx` — v0 app shell with fixed sidebar
- `components/marketing/` — marketing navbar and footer
- `components/brand/brand-logo.tsx` — responsive in-product logo mark and wordmark
- `components/animations/` — accessible CSS/SVG animations for scanning, mapping, extraction, analysis loading, and ambient panel motion
- `app/page.tsx` — marketing landing page
- `app/dashboard/` — dashboard layout + overview page
- `app/favicon.ico`, `app/icon.svg`, `app/apple-icon.png` — Next.js metadata icon set
- `config/navigation.ts` + `config/site.ts` — site and nav configuration
- `public/brand/` — primary logos, compact marks, favicon sources, and app icon sizes
- `public/illustrations/` — product-specific placement illustrations for recovery, intake, maps, assets, and status
- `docs/OLLAMA.md` — Ollama integration guide
- `docs/VISUAL-ASSETS.md` — visual asset inventory, usage rules, placements, and animation examples
- `lib/intake/` — local-only intake contracts, policy limits, strict GitHub URL/ref validation, safe persistence helpers, and URL builders
- `app/api/projects/import/route.ts` — local-only queued scan creation
- `app/api/scans/[scanId]/route.ts` — local-only safe scan status
- `app/dashboard/import/page.tsx` + `components/intake/project-intake-form.tsx` — Phase 1 intake UI
- `supabase/migrations/20260610214115_create_project_intake_foundation.sql` — projects/scans schema and service-role-only transactional RPC
- `supabase/migrations/20260610233821_restrict_phase_1_service_role_grants.sql` — minimum Phase 1 service-role table privileges
- `docs/PROJECT-INTAKE.md` — intake contract, security policy, limits, phased plan, and operational status
- `lib/intake/worker/` + `scripts/intake-worker.ts` — private single-concurrency worker with claims, leases, retries, safe failures
- `supabase/migrations/20260611000000_create_scan_worker_foundation.sql` — durable scan events, retry scheduling, heartbeats, and service-role-only worker RPCs
- `supabase/migrations/20260611113256_qualify_claim_next_scan_columns.sql` — qualified column references in the claim RPC
- `docs/INTAKE-WORKER.md` — Phase 2 worker operations and safety contract
- `lib/intake/archive/` — bounded GitHub metadata resolution, archive download, hostile-entry validation, hashing, and metadata-only inventory (Phase 3)
- `supabase/migrations/20260612000000_create_phase_3_archive_intake.sql` — private scan file inventory and lease-checked Phase 3 RPCs
- `lib/intake/results/` + `components/intake/scan-results/` — validated metadata-only results read model and dashboard presentation (Phase 4)
- `app/dashboard/projects/[projectId]/scans/[scanId]/page.tsx` — server-rendered deterministic scan results route
- `supabase/migrations/20260612010000_create_phase_4_scan_results_read.sql` — bounded service-role-only results read RPC

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7 (App Router) |
| UI Runtime | React 19.2.4 |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui (base-luma style) |
| Icons | lucide-react |
| Brand and Illustrations | Project-owned SVG and generated favicon/app-icon assets |
| Motion | Lightweight CSS/SVG animation components |
| Data Layer | Supabase (postgres + auth) |
| Supabase Helpers | `@supabase/supabase-js`, `@supabase/ssr` |
| Archive Handling | `tar-stream` (bounded, streaming) |
| Testing | Vitest + jsdom (co-located `.test.ts(x)` files) |
| Package Manager | npm |

## Project Structure

```
studio-2/
├── app/
│   ├── api/
│   │   ├── ai/chat/route.ts        # POST /api/ai/chat — stateless Ollama chat
│   │   ├── ai/health/route.ts      # GET /api/ai/health — Ollama reachability probe
│   │   ├── log/route.ts            # POST /api/log — client-side log ingestion
│   │   ├── projects/import/route.ts # POST /api/projects/import — local-only queued scan creation
│   │   └── scans/[scanId]/route.ts # GET /api/scans/[scanId] — local-only safe scan status
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard layout (wraps AppShell)
│   │   ├── page.tsx                # Dashboard overview page
│   │   ├── import/page.tsx         # Local-only public GitHub intake surface
│   │   └── projects/[projectId]/scans/[scanId]/page.tsx # Deterministic scan results view
│   ├── layout.tsx                  # Root layout — fonts, global styles
│   └── page.tsx                    # Marketing landing page
├── components/
│   ├── animations/                 # Accessible scan/map/extraction/loader/ambient motion
│   ├── app/                        # app-shell.tsx, app-sidebar.tsx
│   ├── brand/                      # brand-logo.tsx
│   ├── intake/
│   │   ├── project-intake-form.tsx # Phase 1 GitHub intake form
│   │   └── scan-results/           # Phase 4 scan results presentation
│   ├── marketing/                  # marketing-navbar.tsx, marketing-footer.tsx
│   └── ui/                         # shadcn/ui components (button.tsx)
├── config/                         # navigation.ts (dashboard nav), site.ts (siteConfig)
├── lib/
│   ├── ai/                         # chat-contract, context-builder, conversation-summary,
│   │                               # model-config, model-policy, ollama-client, token-budget
│   ├── logger/                     # client, server, sanitize, types, validation
│   ├── intake/
│   │   ├── contracts.ts / github-url.ts / http.ts / policy.ts / repository.ts / validation.ts
│   │   ├── archive/                # Phase 3: github, download, inventory, classification, policy
│   │   ├── results/                # Phase 4: contracts, formatting, repository (read model)
│   │   └── worker/                 # Phase 2: config, contracts, failures, processor, repository, runner
│   ├── client.ts                   # Supabase browser client
│   ├── server.ts                   # Supabase server client (RSC / Server Actions)
│   ├── middleware.ts               # Supabase session middleware helper
│   └── utils.ts                    # cn() utility
├── scripts/intake-worker.ts        # CLI entry — worker:intake / worker:intake:once
├── supabase/
│   ├── migrations/                 # 7 migrations: logs, intake foundation, grants,
│   │                               # worker foundation, claim fix, phase 3 archive, phase 4 read
│   └── sql/enable_logs_retention.sql # pg_cron daily purge (logs > 30d) — opt-in
├── docs/                           # IMPLEMENTATION_LOG, INTAKE-WORKER, LOGGING, OLLAMA,
│                                   # PROJECT-INTAKE, VISUAL-ASSETS, misc/
└── public/                         # brand/, illustrations/
```

## Architecture Rules

- **App Router only** — no `pages/` directory. All routes live under `app/`.
- **Supabase clients are never global** — always construct per request (Fluid compute safe).
  - Browser: `lib/client.ts` → `createBrowserClient`
  - Server: `lib/server.ts` → `createServerClient` (async, reads cookies)
  - Middleware: `lib/middleware.ts` → `updateSession()` — must be wired in a root `middleware.ts`
- **Logging**: always use `lib/logger/server.ts` on the server, `lib/logger/client.ts` on the client. Never import server logger into Client Components. See `docs/LOGGING.md`.
- **AI**: never call Ollama directly from route handlers. Use `lib/ai/ollama-client.ts` (`chatWithOllama`, `getOllamaModels`). Validate requests with `lib/ai/model-policy.ts` first. Build the message array with `lib/ai/context-builder.ts`. See `docs/OLLAMA.md`.
- **Project intake**: intake is local-only and production-hidden. Validate through `lib/intake/`, never fetch submitted URLs directly, never expose service-role access to clients, and never persist or log source contents. See `docs/PROJECT-INTAKE.md`.
- **Scan results**: Phase 4 displays deterministic metadata only — no source contents, hashes, parsing, system maps, AI, embeddings, or asset extraction. Read through `lib/intake/results/` only.
- **Config**: site metadata → `config/site.ts` (`siteConfig`). Dashboard nav items → `config/navigation.ts` (`dashboardNavigation`).
- **Visual assets**: use `BrandLogo` for in-product branding (static light/dark variants only when assets leave the application), static assets from `public/brand/` and `public/illustrations/`, and reusable motion from `components/animations/` — no one-off motion for feature pages. All motion must respect `prefers-reduced-motion`. Meaningful images require useful alt text; decorative animations must be hidden from assistive technology. See `docs/VISUAL-ASSETS.md`.
- **Testing**: Vitest (`npm run test`). Test files co-located with source (`.test.ts`). Coverage via `npm run test:coverage`.
- **Styling**: Tailwind CSS 4 + shadcn/ui (`base-luma` style). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Path aliases**: `@/` maps to the project root. UI components at `@/components/ui/`, app shell at `@/components/app/`, utilities at `@/lib/`.
- **TypeScript strict mode** is on. Do not use `any` or disable strict checks.

## Product Direction

The studio is a tool developers use when inheriting, recovering, or deeply understanding a codebase. Core MVP directions: **project intake** (ingest a repo, produce a system map), **work-session memory** (persistent context across sessions), **reusable asset extraction** (surface reusable patterns), and **system visualization** (interactive architecture/dependency graph).

## What NOT to build yet

- Do not add authentication pages or auth flows — the system model must be defined first.
- Do not build downstream project-feature pages until intake produces validated, persisted scan evidence.
- Do not persist or log source contents, extract source files to disk, or add AI summaries to the Phase 3 intake boundary.
- Do not expand the AI layer into agent/agentic patterns before the project intake surface is stable.

## Next Steps (in order)

1. Apply the Phase 4 migration (`20260612010000_create_phase_4_scan_results_read.sql`) to the linked Supabase project and run advisors.
2. Decide whether 30-day log retention is required; run `supabase/sql/enable_logs_retention.sql` only after confirming `pg_cron`.
3. Keep local and remote Supabase migration history aligned and run advisors after schema changes.
4. Add deterministic JS/TS scanning before system-map, reusable-asset, status-summary, or AI-summary work.

## Environment Variables

Required in `.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never prefix with NEXT_PUBLIC_
PROJECT_INTAKE_ENABLED=true       # local/dev only; production intake always returns 404
GITHUB_TOKEN=                     # optional; public GitHub rate-limit improvement only
SCAN_WORKER_ID=                   # optional stable worker ID
SCAN_WORKER_LEASE_SECONDS=120
SCAN_WORKER_MAX_ATTEMPTS=3
SCAN_WORKER_POLL_MS=5000
SCAN_WORKER_RETRY_DELAY_SECONDS=60
OLLAMA_GPU_BASE_URL=              # e.g. http://100.86.175.53:11435
OLLAMA_DEFAULT_MODEL=             # e.g. qwen2.5:7b-instruct-q4_K_M
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=256
OLLAMA_RESERVED_RESPONSE_TOKENS=256
OLLAMA_CHAT_TIMEOUT_MS=120000
```

> Last auto-updated: 2026-06-12
