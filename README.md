# studio-2

A codebase intelligence studio — built for project recovery, system visualization, reusable asset extraction, and work-session continuity.

This is a clean Next.js rebuild of `ruizTechStudio`, starting from a clarified product direction with intentional architecture.

## Stack

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
| Package Manager | npm |

## Current Implementation Status

The deterministic application foundation, local-only Phase 1 intake, and
private Phase 2 queue/worker foundation are complete:

- App Router shell, marketing landing page, and dashboard overview
- Centralized server/client logging with Supabase persistence support
- Stateless, token-budgeted Ollama API integration
- Project-owned logo, favicon, app-icon, and placement-illustration library
- Reusable accessible animations for scanning, system mapping, asset extraction,
  project analysis, and subtle dashboard panel motion
- Exact public GitHub repository URL and ref validation
- Local-only `/dashboard/import` workflow with durable queued scan creation and
  safe scan-status polling
- Supabase `projects` and `scans` migration with RLS and service-role-only access
- Durable `scan_events`, atomic claims, leases, heartbeats, retries, and safe
  terminal failure handling
- Manually-run single-concurrency intake worker with process-once and
  continuous polling modes

The worker intentionally stops with `phase_3_not_implemented`; it does not
fetch or scan repositories. The next product milestone is bounded GitHub
archive intake with hostile-input defenses.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Create a `.env.local` file at the project root (never commit this):

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
PROJECT_INTAKE_ENABLED=true
SCAN_WORKER_ID=
SCAN_WORKER_LEASE_SECONDS=120
SCAN_WORKER_MAX_ATTEMPTS=3
SCAN_WORKER_POLL_MS=5000
SCAN_WORKER_RETRY_DELAY_SECONDS=60
OLLAMA_GPU_BASE_URL=http://100.86.175.53:11435
OLLAMA_DEFAULT_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=256
OLLAMA_RESERVED_RESPONSE_TOKENS=256
OLLAMA_CHAT_TIMEOUT_MS=120000
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_`
prefix. The Ollama variables are also server-only. See `docs/LOGGING.md` for
centralized logging setup and usage, `docs/OLLAMA.md` for the stateless local AI
endpoints, `docs/PROJECT-INTAKE.md` for the intake contract,
`docs/INTAKE-WORKER.md` for worker operations, and `docs/VISUAL-ASSETS.md` for
the brand and animation system.

## Project Structure

```
studio-2/
├── app/
│   ├── api/
│   │   ├── ai/
│   │   │   ├── chat/
│   │   │   │   ├── route.ts        # POST /api/ai/chat — stateless Ollama chat endpoint
│   │   │   │   └── route.test.ts
│   │   │   └── health/
│   │   │       ├── route.ts        # GET /api/ai/health — Ollama reachability probe
│   │   │       └── route.test.ts
│   │   └── log/
│   │       ├── route.ts            # POST /api/log — client-side log ingestion endpoint
│   │       └── route.test.ts
│   ├── dashboard/
│   │   ├── layout.tsx              # Dashboard layout (wraps AppShell)
│   │   ├── import/page.tsx          # Local-only public GitHub intake surface
│   │   └── page.tsx                # Dashboard overview page
│   ├── apple-icon.png              # Next.js Apple touch icon
│   ├── icon.svg                    # Next.js scalable app icon
│   ├── layout.tsx                  # Root layout — fonts, global styles
│   └── page.tsx                    # Marketing landing page
├── components/
│   ├── animations/                 # Accessible repo scan, map, extraction, loader, and ambient motion
│   ├── app/
│   │   ├── app-shell.tsx           # Main app layout (sidebar + header + content area)
│   │   └── app-sidebar.tsx         # Fixed sidebar with dashboard navigation
│   ├── brand/
│   │   └── brand-logo.tsx          # Responsive in-product logo mark and wordmark
│   ├── marketing/
│   │   ├── marketing-navbar.tsx    # Public site navbar
│   │   └── marketing-footer.tsx    # Public site footer
│   └── ui/
│       └── button.tsx              # shadcn/ui Button component
├── config/
│   ├── navigation.ts               # dashboardNavigation — sidebar nav items
│   └── site.ts                     # siteConfig — name, description, mainNav
├── lib/
│   ├── ai/
│   │   ├── chat-contract.ts        # Shared message/conversation types
│   │   ├── context-builder.ts      # Builds token-budgeted message array from context
│   │   ├── conversation-summary.ts # Conversation summarization helpers
│   │   ├── model-config.ts         # ModelRequestConfig, env-driven defaults
│   │   ├── model-policy.ts         # Request validation + allowed model list
│   │   ├── ollama-client.ts        # chatWithOllama(), getOllamaModels(), OllamaClientError
│   │   └── token-budget.ts         # Token estimation and budget enforcement
│   ├── logger/
│   │   ├── client.ts               # Client-side logger (posts to /api/log)
│   │   ├── server.ts               # Server-side logger (writes directly to Supabase)
│   │   ├── sanitize.ts             # Recursive redaction of sensitive keys
│   │   ├── types.ts                # LogLevel, LogSource, LogInput, StoredLogEntry
│   │   └── validation.ts           # validateLogInput(), isUuid()
│   ├── intake/                      # Intake contracts, validation, persistence, and private worker foundation
│   ├── client.ts                   # Supabase browser client
│   ├── server.ts                   # Supabase server client (RSC / Server Actions)
│   ├── middleware.ts               # Supabase session middleware helper
│   └── utils.ts                    # cn() utility (clsx + tailwind-merge)
├── supabase/
│   ├── migrations/
│   │   ├── 20260609000000_create_logs.sql   # public.logs table + RLS + indexes
│   │   ├── 20260610214115_create_project_intake_foundation.sql
│   │   ├── 20260610233821_restrict_phase_1_service_role_grants.sql
│   │   └── 20260611000000_create_scan_worker_foundation.sql
│   └── sql/
│       └── enable_logs_retention.sql        # pg_cron daily purge (logs > 30d)
├── docs/
│   ├── IMPLEMENTATION_LOG.md  # Historical implementation record and current milestone updates
│   ├── INTAKE-WORKER.md        # Phase 2 worker operations and safety contract
│   ├── LOGGING.md              # Logging system usage guide
│   ├── OLLAMA.md               # Ollama AI integration guide
│   ├── PROJECT-INTAKE.md       # Phase 1 and 2 intake contract, policy, and phased plan
│   └── VISUAL-ASSETS.md        # Brand, illustration, favicon, and animation inventory
├── public/
│   ├── brand/                  # Static logo variants, favicon sources, and app icons
│   └── illustrations/          # Product-specific placement illustrations
├── components.json             # shadcn/ui config
├── next.config.ts              # Next.js config
├── vitest.config.ts            # Vitest test runner config
├── tsconfig.json               # TypeScript config
└── AGENTS.md                   # AI agent rules for this repo
```

## Key Conventions

- Use `lib/server.ts` for Supabase calls inside Server Components and Server Actions. Create a new client per request — do not cache globally (Fluid compute compatibility).
- Use `lib/client.ts` for Supabase calls inside Client Components.
- `lib/middleware.ts` exports `updateSession()` — wire it into a `middleware.ts` file at the project root to keep auth sessions alive.
- All component aliases route through `@/` (mapped to the project root in `tsconfig.json`).
- `cn()` from `lib/utils.ts` is the standard utility for conditional Tailwind classes.
- Use `lib/logger/server.ts` from Route Handlers, Server Actions, and server code. Use `lib/logger/client.ts` from Client Components. See `docs/LOGGING.md` for full usage.
- AI chat goes through `lib/ai/` modules — never call Ollama directly from a route handler. Use `chatWithOllama()` from `lib/ai/ollama-client.ts` after validating via `lib/ai/model-policy.ts`.
- Site/nav config lives in `config/` — update `config/navigation.ts` to add dashboard routes, `config/site.ts` for top-level site metadata.
- Use `BrandLogo` for in-product branding. Use static light/dark logo variants only when assets leave the application.
- Reuse animations from `components/animations/`; do not create one-off motion for feature pages. All motion must respect `prefers-reduced-motion`.
- Meaningful illustrations require useful alt text. Decorative images use empty alt text, and decorative animations must be hidden from assistive technology.

## Scripts

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run start         # Start production server
npm run lint          # ESLint
npm run test          # Vitest (run once)
npm run test:watch    # Vitest watch mode
npm run test:coverage # Vitest with coverage report
npm run worker:intake:once # Process at most one eligible scan
npm run worker:intake      # Poll the private scan queue continuously
```

## Product Direction

The goal of this studio is to become a tool developers use when inheriting, recovering, or deeply understanding a codebase. Core MVP directions:

- **Project intake** — ingest a repo and produce a system map
- **Work-session memory** — persistent context across sessions
- **Reusable asset extraction** — surface reusable patterns from existing code
- **System visualization** — interactive graph of architecture and dependencies

See `docs/IMPLEMENTATION_LOG.md` for the full setup history.
See `docs/PROJECT-INTAKE.md` for the project intake contract and phased plan.
See `docs/VISUAL-ASSETS.md` for the implemented visual foundation and adoption guidance.

> Last auto-updated: 2026-06-11
