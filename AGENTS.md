<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# studio-2 — Agent Context

This is a **codebase intelligence studio** — not a generic SaaS app. The product goal is project recovery, system visualization, reusable asset extraction, and work-session continuity.

## Current State (as of 2026-06-10)

Branch: `codex/project-intake-foundation`. The v0 app shell, Ollama integration, marketing surface, and visual asset foundation are complete. Phase 1 of project intake is implemented locally; queue processing and deterministic scanning have not started.

Completed since initial scaffold:
- `lib/logger/` — full logging module (types, sanitizer, validator, server writer, client poster)
- `app/api/log/route.ts` — POST /api/log client-side log ingestion
- `supabase/migrations/20260609000000_create_logs.sql` — `public.logs` table with RLS
- `lib/ai/` — stateless Ollama AI module: context builder, token budget, model policy, ollama client, conversation summary, model config
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
- `docs/PROJECT-INTAKE.md` — intake contract, security policy, limits, phased plan, and operational blocker

## Architecture Rules

- **App Router only** — no `pages/` directory. All routes live under `app/`.
- **Supabase clients are never global** — always construct per request (Fluid compute safe).
  - Browser: `lib/client.ts` → `createBrowserClient`
  - Server: `lib/server.ts` → `createServerClient` (async, reads cookies)
  - Middleware: `lib/middleware.ts` → `updateSession()` — must be wired in a root `middleware.ts`
- **Logging**: always use `lib/logger/server.ts` on the server, `lib/logger/client.ts` on the client. Never import server logger into Client Components. See `docs/LOGGING.md`.
- **AI**: never call Ollama directly from route handlers. Use `lib/ai/ollama-client.ts` (`chatWithOllama`, `getOllamaModels`). Validate requests with `lib/ai/model-policy.ts` first. Build the message array with `lib/ai/context-builder.ts`. See `docs/OLLAMA.md`.
- **Project intake**: intake is local-only and production-hidden. Validate through `lib/intake/`, never fetch submitted URLs directly, never expose service-role access to clients, and never persist or log source contents. See `docs/PROJECT-INTAKE.md`.
- **Config**: site metadata → `config/site.ts` (`siteConfig`). Dashboard nav items → `config/navigation.ts` (`dashboardNavigation`).
- **Visual assets**: use `BrandLogo` for in-product branding, static assets from `public/brand/` and `public/illustrations/`, and reusable motion from `components/animations/`. Meaningful images require useful alt text; decorative animations must be hidden from assistive technology. See `docs/VISUAL-ASSETS.md`.
- **Testing**: Vitest (`npm run test`). Test files co-located with source (`.test.ts`). Coverage via `npm run test:coverage`.
- **Styling**: Tailwind CSS 4 + shadcn/ui (`base-luma` style). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Path aliases**: `@/` maps to the project root. UI components at `@/components/ui/`, app shell at `@/components/app/`, utilities at `@/lib/`.
- **TypeScript strict mode** is on. Do not use `any` or disable strict checks.

## What NOT to build yet

- Do not add authentication pages or auth flows — the system model must be defined first.
- Do not build downstream project-feature pages until intake produces validated, persisted scan evidence.
- Do not add queues, workers, repository fetching, archive extraction, parsers, or AI summaries to Phase 1.
- Do not expand the AI layer into agent/agentic patterns before the project intake surface is stable.

## Next Steps (in order)

1. Apply Supabase migration if not yet done: `supabase/migrations/20260609000000_create_logs.sql`.
2. (Optional) Enable log retention: run `supabase/sql/enable_logs_retention.sql` after confirming `pg_cron` is enabled.
3. Reconnect and verify authoritative Supabase project `lyclwqvmbhiwlxffcnbw`.
4. Apply and verify the Phase 1 intake migration; run security and performance advisors.
5. Build Phase 2 private queue and single-concurrency worker with leases, retries, events, and cleanup.
6. Build bounded GitHub archive intake and hostile-input fixtures.
7. Add deterministic JS/TS scanning before system-map, reusable-asset, status-summary, or AI-summary work.

## Environment Variables

Required in `.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never prefix with NEXT_PUBLIC_
PROJECT_INTAKE_ENABLED=true       # local/dev only; production intake always returns 404
OLLAMA_GPU_BASE_URL=              # e.g. http://100.86.175.53:11435
OLLAMA_DEFAULT_MODEL=             # e.g. qwen2.5:7b-instruct-q4_K_M
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=256
OLLAMA_RESERVED_RESPONSE_TOKENS=256
OLLAMA_CHAT_TIMEOUT_MS=120000
```

> Last auto-updated: 2026-06-10
