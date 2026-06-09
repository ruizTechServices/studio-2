<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# studio-2 — Agent Context

This is a **codebase intelligence studio** — not a generic SaaS app. The product goal is project recovery, system visualization, reusable asset extraction, and work-session continuity.

## Current State (as of 2026-06-09)

Foundation is set up but the initial commit has not been made (branch `app-s` has no commits yet). The centralized logging system is fully implemented and tested. The app shell and feature work have not started.

Key additions since initial scaffold:
- `lib/logger/` — full logging module (types, sanitizer, validator, server writer, client poster)
- `app/api/log/route.ts` — POST endpoint for client-side log ingestion
- `supabase/migrations/20260609000000_create_logs.sql` — `public.logs` table with RLS
- `vitest.config.ts` + test files across the logger module
- `docs/LOGGING.md` — logging usage guide

Before adding features, commit the foundation:

```bash
npm run lint
npm run test
npm run build
git add -A
git commit -m "chore: initialize studio-2 Next.js foundation with logging"
```

## Architecture Rules

- **App Router only** — no `pages/` directory. All routes live under `app/`.
- **Supabase clients are never global** — always construct per request (Fluid compute safe).
  - Browser: `lib/client.ts` → `createBrowserClient`
  - Server: `lib/server.ts` → `createServerClient` (async, reads cookies)
  - Middleware: `lib/middleware.ts` → `updateSession()` — must be wired in a root `middleware.ts`
- **Logging**: always use `lib/logger/server.ts` on the server, `lib/logger/client.ts` on the client. Never import server logger into Client Components. See `docs/LOGGING.md`.
- **Testing**: Vitest (`npm run test`). Test files co-located with source (`.test.ts`). Coverage via `npm run test:coverage`.
- **Styling**: Tailwind CSS 4 + shadcn/ui (`base-luma` style). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Path aliases**: `@/` maps to the project root. UI components at `@/components/ui/`, utilities at `@/lib/`.
- **TypeScript strict mode** is on. Do not use `any` or disable strict checks.

## What NOT to build yet

- Do not implement AI agent features before the app shell is coherent.
- Do not add a full dashboard before the system model is defined.
- Do not add authentication pages until the shell layout exists.

## Next Steps (in order)

1. Commit the foundation (`git add -A && git commit`).
2. Apply Supabase migration: `supabase/migrations/20260609000000_create_logs.sql`.
3. (Optional) Enable log retention: run `supabase/sql/enable_logs_retention.sql` after confirming `pg_cron` is enabled.
4. Build the app shell: sidebar, topbar, main content area under `components/layout/`.
5. Build the first feature: project intake flow.

## Environment Variables

Required in `.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, never prefix with NEXT_PUBLIC_
```

> Last auto-updated: 2026-06-09
