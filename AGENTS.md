<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# studio-2 — Agent Context

This is a **codebase intelligence studio** — not a generic SaaS app. The product goal is project recovery, system visualization, reusable asset extraction, and work-session continuity.

## Current State (as of 2026-06-10)

Branch: `app-shell`. The v0 app shell is complete and committed. The Ollama AI integration is fully implemented and tested. The marketing landing page is live. Feature work (project intake, system map, etc.) has not started.

Completed since initial scaffold:
- `lib/logger/` — full logging module (types, sanitizer, validator, server writer, client poster)
- `app/api/log/route.ts` — POST /api/log client-side log ingestion
- `supabase/migrations/20260609000000_create_logs.sql` — `public.logs` table with RLS
- `lib/ai/` — stateless Ollama AI module: context builder, token budget, model policy, ollama client, conversation summary, model config
- `app/api/ai/chat/route.ts` — POST /api/ai/chat — stateless, token-budgeted Ollama chat
- `app/api/ai/health/route.ts` — GET /api/ai/health — Ollama reachability probe
- `components/app/app-shell.tsx` + `app-sidebar.tsx` — v0 app shell with fixed sidebar
- `components/marketing/` — marketing navbar and footer
- `app/page.tsx` — marketing landing page
- `app/dashboard/` — dashboard layout + overview page
- `config/navigation.ts` + `config/site.ts` — site and nav configuration
- `docs/OLLAMA.md` — Ollama integration guide

## Architecture Rules

- **App Router only** — no `pages/` directory. All routes live under `app/`.
- **Supabase clients are never global** — always construct per request (Fluid compute safe).
  - Browser: `lib/client.ts` → `createBrowserClient`
  - Server: `lib/server.ts` → `createServerClient` (async, reads cookies)
  - Middleware: `lib/middleware.ts` → `updateSession()` — must be wired in a root `middleware.ts`
- **Logging**: always use `lib/logger/server.ts` on the server, `lib/logger/client.ts` on the client. Never import server logger into Client Components. See `docs/LOGGING.md`.
- **AI**: never call Ollama directly from route handlers. Use `lib/ai/ollama-client.ts` (`chatWithOllama`, `getOllamaModels`). Validate requests with `lib/ai/model-policy.ts` first. Build the message array with `lib/ai/context-builder.ts`. See `docs/OLLAMA.md`.
- **Config**: site metadata → `config/site.ts` (`siteConfig`). Dashboard nav items → `config/navigation.ts` (`dashboardNavigation`).
- **Testing**: Vitest (`npm run test`). Test files co-located with source (`.test.ts`). Coverage via `npm run test:coverage`.
- **Styling**: Tailwind CSS 4 + shadcn/ui (`base-luma` style). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Path aliases**: `@/` maps to the project root. UI components at `@/components/ui/`, app shell at `@/components/app/`, utilities at `@/lib/`.
- **TypeScript strict mode** is on. Do not use `any` or disable strict checks.

## What NOT to build yet

- Do not add authentication pages or auth flows — the system model must be defined first.
- Do not build project-feature sub-pages (Projects, System Map, Work Sessions, etc.) until the project intake flow exists.
- Do not expand the AI layer into agent/agentic patterns before the project intake surface is stable.

## Next Steps (in order)

1. Apply Supabase migration if not yet done: `supabase/migrations/20260609000000_create_logs.sql`.
2. (Optional) Enable log retention: run `supabase/sql/enable_logs_retention.sql` after confirming `pg_cron` is enabled.
3. Build the project intake flow (`/dashboard/import`) — file/URL input, initial scan, display of parsed structure.
4. Define the system model schema (what a "project" is in the DB).
5. Build the system map view once intake produces real data.

## Environment Variables

Required in `.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-only, never prefix with NEXT_PUBLIC_
OLLAMA_GPU_BASE_URL=              # e.g. http://100.86.175.53:11435
OLLAMA_DEFAULT_MODEL=             # e.g. qwen2.5:7b-instruct-q4_K_M
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=256
OLLAMA_RESERVED_RESPONSE_TOKENS=256
OLLAMA_CHAT_TIMEOUT_MS=120000
```

> Last auto-updated: 2026-06-10
