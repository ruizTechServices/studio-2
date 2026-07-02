<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# studio-2 — Agent Context

This is a **codebase intelligence studio** — not a generic SaaS app. The product goal is project recovery, system visualization, reusable asset extraction, and work-session continuity. It is a clean Next.js rebuild of `ruizTechStudio` with intentional architecture.

## Current State (as of 2026-07-01)

Latest phase: **Phase 9 retrieval-on-demand (bounded source preview)**. The Phase 8 shelf loop is verified end to end against the linked Supabase project (scan → promote → search → re-scan version bump), migration history is aligned (`20260701120000` repaired after a manual SQL-editor apply), and Phase 9 adds on-demand source preview: a shelf asset's file is fetched from GitHub at its pinned 40-hex commit, sliced in route-handler memory (256 KiB / 200 lines / 500 chars-per-line / 8 s bounds), and returned to the local-only surface — never persisted or logged. Source contents are never stored; AI summaries, embeddings, semantic search, and graph visualization have not started. See `docs/SHELVES.md` for the pointer-model rationale and the remaining roadmap (semantic search → workspace → marketplace).

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
- `lib/intake/system-map/` + `components/intake/scan-results/system-map-seed-view.tsx` — deterministic metadata-only structure seed and compact overview (Phase 5)
- `supabase/migrations/20260612020000_create_phase_5_system_map_seed_read.sql` — service-role-only metadata read for system-map seed generation
- `lib/intake/symbols/` + `components/intake/scan-results/symbol-summary-view.tsx` — TypeScript-compiler-API extraction (imports, exports, functions, components, hooks, API handlers, types, constants) persisted as metadata-only symbol rows, plus a bounded symbol summary view (Phase 6)
- `supabase/migrations/20260614000000_create_phase_6_symbol_scanning.sql` — private metadata-only symbol storage, lease-checked batches, atomic count verification, and a service-role-only symbol-summary read RPC
- `lib/intake/reusable-assets/` + `components/intake/scan-results/reusable-asset-candidates-view.tsx` — pure deterministic classifier scoring reusable asset candidates from existing file/symbol metadata, plus a compact candidates view (Phase 7)
- `supabase/migrations/20260615000000_create_phase_7_reusable_asset_candidates.sql` — private metadata-only candidate persistence, atomic finalization verification, and a bounded service-role candidate-summary RPC
- `supabase/migrations/20260701025502_phase_7_advisor_triage.sql` — explicit deny-all client RLS policies for private intake/log tables and an index for `scan_reusable_asset_candidates.project_id`
- `lib/shelves/` + `components/shelves/` + `app/dashboard/shelves/page.tsx` — Phase 8 durable shelf library: candidate promotion, versioned provenance-pointer assets, bounded lexical search, facet UI, and an "Add to shelf" action on scan-results candidate cards
- `app/api/shelves/route.ts` + `app/api/shelves/promote/route.ts` — local-only shelf search and promotion endpoints
- `supabase/migrations/20260701120000_create_phase_8_shelves.sql` — `shelf_assets` table (deny-all RLS, GIN-indexed tsvector search, dormant marketplace columns) with service-role-only promote/search RPCs
- `lib/shelves/retrieval/` + `app/api/shelves/[assetId]/source/route.ts` + `components/shelves/source-preview-panel.tsx` — Phase 9 bounded retrieval-on-demand: pointer RPC read, hostile-path/SHA validation, bounded GitHub raw fetch, in-memory line slicing, and a "Preview source" panel on shelf cards
- `supabase/migrations/20260701233155_create_phase_9_shelf_retrieval_pointer.sql` — service-role-only `get_shelf_asset_retrieval_pointer` RPC
- `docs/SHELVES.md` — shelf architecture, pointer-model rationale, Phase 9 retrieval documentation, and Phases 10–12 roadmap

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
│   │   ├── scans/[scanId]/route.ts # GET /api/scans/[scanId] — local-only safe scan status
│   │   └── shelves/               # P8: route.ts (search), promote/route.ts (candidate promotion);
│   │                               # P9: [assetId]/source/route.ts (bounded source preview)
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard layout (wraps AppShell)
│   │   ├── page.tsx                # Dashboard overview page
│   │   ├── import/page.tsx         # Local-only public GitHub intake surface
│   │   ├── projects/[projectId]/scans/[scanId]/page.tsx # Deterministic scan results view
│   │   └── shelves/page.tsx        # P8: durable shelf library (search + facets)
│   ├── layout.tsx                  # Root layout — fonts, global styles
│   └── page.tsx                    # Marketing landing page
├── components/
│   ├── animations/                 # Accessible scan/map/extraction/loader/ambient motion
│   ├── app/                        # app-shell.tsx, app-sidebar.tsx
│   ├── brand/                      # brand-logo.tsx
│   ├── intake/
│   │   ├── project-intake-form.tsx # Phase 1 GitHub intake form
│   │   └── scan-results/           # scan-results-view, system-map-seed-view (P5),
│   │                               # symbol-summary-view (P6), reusable-asset-candidates-view (P7)
│   ├── marketing/                  # marketing-navbar.tsx, marketing-footer.tsx
│   ├── shelves/                    # P8: shelf-library-view, promote-candidate-button; P9: source-preview-panel
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
│   │   ├── system-map/             # Phase 5: build-system-map-seed, classifiers, contracts, formatting
│   │   ├── symbols/                # Phase 6: contracts, extract (TS-compiler-API symbol extraction)
│   │   ├── reusable-assets/        # Phase 7: contracts, classify (candidate scoring)
│   │   └── worker/                 # Phase 2: config, contracts, failures, processor, repository, runner
│   ├── shelves/                    # Phase 8: contracts, validation, repository (promote + search RPCs)
│   │   └── retrieval/              # Phase 9: contracts, validation, github-source-client, line-slicer, repository
│   ├── client.ts                   # Supabase browser client
│   ├── server.ts                   # Supabase server client (RSC / Server Actions)
│   ├── middleware.ts               # Supabase session middleware helper
│   └── utils.ts                    # cn() utility
├── scripts/intake-worker.ts        # CLI entry — worker:intake / worker:intake:once
├── supabase/
│   ├── migrations/                 # 12 migrations: logs, intake foundation, grants,
│   │                               # worker foundation, claim fix, phase 3 archive,
│   │                               # phase 4 read, phase 5 system-map seed read,
│   │                               # phase 6 symbol scanning, phase 7 reusable asset candidates,
│   │                               # phase 7 advisor triage, phase 8 shelves
│   └── sql/enable_logs_retention.sql # pg_cron daily purge (logs > 30d) — opt-in
├── docs/                           # IMPLEMENTATION_LOG, INTAKE-WORKER, LOGGING, OLLAMA,
│                                   # PROJECT-INTAKE, SDLC, SHELVES, VISUAL-ASSETS, misc/
└── public/                         # brand/, illustrations/, images/
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
- **Scan results, system-map seed, symbols, and reusable-asset candidates**: derive compact deterministic models from private `scan_files`/symbol metadata only. Source is parsed only in bounded worker memory and is never persisted, logged, returned, or written to disk. No graph canvas, AI, embeddings, or semantic search. Read through `lib/intake/results/`; build through `lib/intake/system-map/` (P5), `lib/intake/symbols/` (P6 TS-compiler-API extraction), and `lib/intake/reusable-assets/` (P7 candidate scoring). Candidates require review and are not guaranteed reusable.
- **Shelves (P8)**: shelf assets are provenance pointers (owner/repo/commit/path/lines) plus deterministic metadata — never source contents. Promotion is an explicit human action from scan results. Validate through `lib/shelves/validation.ts`, persist and search only through `lib/shelves/repository.ts` RPC wrappers, and keep the surface behind `isProjectIntakeEnabled()`. Marketplace columns (`visibility`, `price_cents`, `published_at`) stay dormant until an auth + billing phase. See `docs/SHELVES.md`.
- **Retrieval-on-demand (P9)**: source previews are fetched only from `raw.githubusercontent.com` at the asset's pinned 40-hex commit through `lib/shelves/retrieval/github-source-client.ts` (no redirects, 256 KiB byte cap, binary rejection, 8 s timeout), sliced in memory via `lib/shelves/retrieval/line-slicer.ts` (200 lines, 500 chars/line), and returned with `cache-control: no-store`. Validate pointers with `lib/shelves/retrieval/validation.ts` before any fetch. Never persist, log, or write fetched source to disk. Phase 9 is deterministic retrieval only — no AI interpretation.
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

1. Run security and performance advisors on the linked project from a dashboard account with sufficient privileges (CLI/MCP advisor access currently returns 403) and triage any new findings from the Phase 8/9 objects.
2. Exercise Phase 9 in the browser (expand "Preview source" on a shelf card) and against edge cases: binary files, oversized files, deleted upstream repositories.
3. Add semantic search (pgvector + local Ollama embeddings over `search_text`) — Phase 10 — now that retrieval-on-demand is stable.
4. Treat the remaining performance advisor `unused_index` INFO findings as deferred until real scan/log traffic can prove whether any index is waste.
5. Decide whether 30-day log retention is required; run `supabase/sql/enable_logs_retention.sql` only after confirming `pg_cron`.
6. Design the Phase 11 workspace (asset palette dropping shelf assets into a working tree via retrieval-on-demand) only after semantic search lands.

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

> Last auto-updated: 2026-07-01
