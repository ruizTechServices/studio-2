<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# studio-2 — Agent Context

This is a **codebase intelligence studio** — not a generic SaaS app. The product goal is project recovery, system visualization, reusable asset extraction, and work-session continuity.

## Current State (as of 2026-06-08)

Foundation is set up but uncommitted. The app shell and feature work have not started yet. Before adding any features, the initial foundation commit must be made:

```bash
# Verify before committing
npm run lint
npm run build

# Stage and commit
git add .gitignore app/globals.css app/layout.tsx package.json package-lock.json components.json components lib IMPLEMENTATION_LOG.md
git commit -m "chore: initialize studio-2 Next.js foundation"
```

## Architecture Rules

- **App Router only** — no `pages/` directory. All routes live under `app/`.
- **Supabase clients are never global** — always construct per request (Fluid compute safe).
  - Browser: `lib/client.ts` → `createBrowserClient`
  - Server: `lib/server.ts` → `createServerClient` (async, reads cookies)
  - Middleware: `lib/middleware.ts` → `updateSession()` — must be wired in a root `middleware.ts`
- **Styling**: Tailwind CSS 4 + shadcn/ui (`base-luma` style). Use `cn()` from `lib/utils.ts` for conditional classes.
- **Path aliases**: `@/` maps to the project root. UI components at `@/components/ui/`, utilities at `@/lib/`.
- **TypeScript strict mode** is on. Do not use `any` or disable strict checks.

## What NOT to build yet

- Do not implement AI agent features before the app shell is coherent.
- Do not add a full dashboard before the system model is defined.
- Do not add authentication pages until the shell layout exists.

## Next Steps (in order)

1. Commit the foundation.
2. Build the app shell: `app/layout.tsx`, sidebar, topbar, main content area.
3. Build the first feature: project intake flow.

## Environment Variables

Required in `.env.local` (never commit):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

> Last auto-updated: 2026-06-08
