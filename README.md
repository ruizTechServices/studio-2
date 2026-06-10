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
| Data Layer | Supabase (postgres + auth) |
| Supabase Helpers | `@supabase/supabase-js`, `@supabase/ssr` |
| Package Manager | npm |

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
OLLAMA_GPU_BASE_URL=http://100.86.175.53:11435
OLLAMA_DEFAULT_MODEL=qwen2.5:7b-instruct-q4_K_M
OLLAMA_NUM_CTX=4096
OLLAMA_NUM_PREDICT=256
OLLAMA_RESERVED_RESPONSE_TOKENS=256
OLLAMA_CHAT_TIMEOUT_MS=120000
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_`
prefix. The Ollama variables are also server-only. See `docs/LOGGING.md` for
centralized logging setup and usage and `docs/OLLAMA.md` for the stateless
local AI endpoints.

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
│   │   └── page.tsx                # Dashboard overview page
│   ├── layout.tsx                  # Root layout — fonts, global styles
│   └── page.tsx                    # Marketing landing page
├── components/
│   ├── app/
│   │   ├── app-shell.tsx           # Main app layout (sidebar + header + content area)
│   │   └── app-sidebar.tsx         # Fixed sidebar with dashboard navigation
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
│   ├── client.ts                   # Supabase browser client
│   ├── server.ts                   # Supabase server client (RSC / Server Actions)
│   ├── middleware.ts               # Supabase session middleware helper
│   └── utils.ts                    # cn() utility (clsx + tailwind-merge)
├── supabase/
│   ├── migrations/
│   │   └── 20260609000000_create_logs.sql   # public.logs table + RLS + indexes
│   └── sql/
│       └── enable_logs_retention.sql        # pg_cron daily purge (logs > 30d)
├── docs/
│   ├── LOGGING.md              # Logging system usage guide
│   ├── OLLAMA.md               # Ollama AI integration guide
│   └── IMPLEMENTATION_LOG.md  # Historical setup log
├── public/                     # Static assets
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

## Scripts

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm run start         # Start production server
npm run lint          # ESLint
npm run test          # Vitest (run once)
npm run test:watch    # Vitest watch mode
npm run test:coverage # Vitest with coverage report
```

## Product Direction

The goal of this studio is to become a tool developers use when inheriting, recovering, or deeply understanding a codebase. Core MVP directions:

- **Project intake** — ingest a repo and produce a system map
- **Work-session memory** — persistent context across sessions
- **Reusable asset extraction** — surface reusable patterns from existing code
- **System visualization** — interactive graph of architecture and dependencies

See `docs/IMPLEMENTATION_LOG.md` for the full setup history.

> Last auto-updated: 2026-06-10
