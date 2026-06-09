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
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only and must never use a `NEXT_PUBLIC_`
prefix. See `docs/LOGGING.md` for centralized logging setup and usage.

## Project Structure

```
studio-2/
├── app/
│   ├── layout.tsx        # Root layout — fonts, global styles
│   └── page.tsx          # Home page (placeholder)
├── components/
│   └── ui/
│       └── button.tsx    # shadcn/ui Button component
├── lib/
│   ├── client.ts         # Supabase browser client
│   ├── server.ts         # Supabase server client (RSC / Server Actions)
│   ├── middleware.ts      # Supabase session middleware helper
│   └── utils.ts          # cn() utility (clsx + tailwind-merge)
├── public/               # Static assets
├── components.json       # shadcn/ui config
├── next.config.ts        # Next.js config
├── tsconfig.json         # TypeScript config
└── AGENTS.md             # AI agent rules for this repo
```

## Key Conventions

- Use `lib/server.ts` for Supabase calls inside Server Components and Server Actions. Create a new client per request — do not cache globally (Fluid compute compatibility).
- Use `lib/client.ts` for Supabase calls inside Client Components.
- `lib/middleware.ts` exports `updateSession()` — wire it into a `middleware.ts` file at the project root to keep auth sessions alive.
- All component aliases route through `@/` (mapped to the project root in `tsconfig.json`).
- `cn()` from `lib/utils.ts` is the standard utility for conditional Tailwind classes.

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

## Product Direction

The goal of this studio is to become a tool developers use when inheriting, recovering, or deeply understanding a codebase. Core MVP directions:

- **Project intake** — ingest a repo and produce a system map
- **Work-session memory** — persistent context across sessions
- **Reusable asset extraction** — surface reusable patterns from existing code
- **System visualization** — interactive graph of architecture and dependencies

See `docs/IMPLEMENTATION_LOG.md` for the full setup history.

> Last auto-updated: 2026-06-08
