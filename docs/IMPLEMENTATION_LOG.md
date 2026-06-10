# STUDIO-2

## *A Codebase Intelligence Studio, Built From the Ground Up*

**PROJECT LOG · MAIN BRANCH · NEXT.JS REBUILD**

---

> *"Build the foundation before the features. Deterministic first, intelligent second."*

---

## THE STORY SO FAR

**studio-2** is the clean Next.js recreation of `ruizTechStudio`.

This is not a patch job. It is a controlled rebuild designed to give the project a clearer architecture, stronger separation of concerns, cleaner implementation records, and a more coherent path toward the real product goal:

> Build a codebase intelligence studio for project recovery, system visualization, reusable asset extraction, and work-session continuity.

Where `studio-1` helped clarify the product direction, `studio-2` starts from that clarified direction and rebuilds the foundation with intention.

The mission is simple. The execution is not.

---

## THE STACK

*Everything this project currently stands on.*

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.7 |
| Runtime UI | React 19.2.4 |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Components | shadcn/ui |
| Data Layer | Supabase |
| Supabase Helpers | `@supabase/supabase-js`, `@supabase/ssr` |
| Package Manager | npm |

---

## CURRENT OBJECTIVE

> **Verify the local-only Phase 1 intake foundation, then add durable private
> queue processing before repository fetching or scanning.**

The deterministic foundation is complete: app shell, marketing surface,
logging, stateless Ollama integration, and the visual asset system. The next
work must turn an imported repository into a validated normalized result.

Do not build authentication flows, speculative system-map pages, or agentic
automation before the intake contract is stable.

## CURRENT MILESTONE SNAPSHOT — 2026-06-10

Branch: `codex/project-intake-foundation`

Completed:

- App Router marketing page, dashboard shell, sidebar, and overview
- Centralized logging module, ingestion endpoint, migration, and retention SQL
- Stateless token-budgeted Ollama chat and health endpoints
- Project-owned visual foundation:
  - Responsive `BrandLogo`
  - Light/dark static logo and compact-mark variants
  - Next.js favicon, SVG app icon, Apple touch icon, and external app-icon sizes
  - Six product-specific placement illustrations
  - Five reusable CSS/SVG animation components with reduced-motion support
- Homepage hero, marketing chrome, dashboard sidebar, and dashboard ambient
  motion integrations
- Visual asset inventory and usage guidance in `docs/VISUAL-ASSETS.md`
- Local-only project intake foundation:
  - Exact public GitHub URL and separate ref validation
  - Central resource-limit and environment-gate policy
  - Durable `projects` and immutable queued `scans` schema
  - Service-role-only transactional project/scan creation RPC
  - Gated project import and scan-status APIs
  - `/dashboard/import` form, queued status, and two-second status polling
  - Phase 1 tests and `docs/PROJECT-INTAKE.md`

Verified:

- `npm run lint`
- `npx tsc --noEmit`
- `npm run test` — 14 files, 117 tests
- `npm run build`
- SVG parsing and browser DOM/accessibility inspection

Not started:

- Private Supabase Queue and scan worker
- Repository fetching, safe archive extraction, and deterministic scanning
- Persistent scan evidence beyond projects and scan runs
- System map, reusable-assets, and work-session feature surfaces

---

## IMPLEMENTATION RECORD

### STEP 1 — Confirm Repo Location and Branch

```bash
git branch --show-current
git status --short
pwd

Result:

main
/c/Users/giost/CascadeProjects/projects/application-studio/studio-2
STEP 2 — Capture Context Snapshot

A diagnostic context snapshot was generated to inspect the current app structure, package state, shadcn/ui setup, Supabase setup, and Git status.

Snapshot file:

studio-2-context-snapshot.txt

Important:

This file is temporary diagnostic output and should not be committed.

Snapshot result:

Completed.

Known issue during snapshot command:

bash: !fs.existsSync: event not found

Git Bash interpreted part of the Node inline script as shell history expansion. This did not block the useful inspection.

STEP 3 — Verify Current Git State
git status --short

Result:

 M .gitignore
 M app/globals.css
 M app/layout.tsx
 M package-lock.json
 M package.json
?? IMPLEMENTATION_LOG.md
?? components.json
?? components/
?? lib/
?? studio-2-context-snapshot.txt

Interpretation:

The app has uncommitted setup changes for:

Next.js base files
Tailwind/global styling
shadcn/ui config
shadcn/ui button component
Supabase client/server/middleware helpers
npm package updates
implementation log

The temporary snapshot file should be removed before commit.

STEP 4 — shadcn/ui Initialized

shadcn/ui is installed and configured.

Evidence:

components.json
components/ui/button.tsx
lib/utils.ts

Current shadcn/ui config highlights:

Style: base-luma
Base color: neutral
RSC: true
TSX: true
Icon library: lucide
CSS file: app/globals.css
UI alias: @/components/ui
Utils alias: @/lib/utils

Current installed UI component:

button
STEP 5 — Supabase Packages Installed

Supabase packages are installed.

Installed packages:

@supabase/supabase-js
@supabase/ssr

Detected versions:

@supabase/ssr@0.10.3
@supabase/supabase-js@2.108.0
STEP 6 — Supabase Helper Files Created

Supabase helper files exist.

Detected files:

lib/client.ts
lib/server.ts
lib/middleware.ts

Purpose:

File	Purpose
lib/client.ts	Browser/client Supabase client
lib/server.ts	Server-side Supabase client
lib/middleware.ts	Supabase session middleware helper
STEP 7 — Environment File Present

.env.local exists.

Important:

Do not paste secret values into chat.
Do not commit .env.local.

The expected public Supabase variables are:

NEXT_PUBLIC_SUPABASE_URL=present
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=present

The actual values must remain local.

CURRENT FILE STRUCTURE SNAPSHOT

Current relevant files:

app/favicon.ico
app/globals.css
app/layout.tsx
app/page.tsx
components.json
components/ui/button.tsx
lib/client.ts
lib/middleware.ts
lib/server.ts
lib/utils.ts
package.json
package-lock.json
postcss.config.mjs
next.config.ts
tsconfig.json
eslint.config.mjs
IMPLEMENTATION_LOG.md

Temporary file to remove before commit:

studio-2-context-snapshot.txt
CURRENT PACKAGE STATE

Current package identity:

{
  "name": "studio-2",
  "version": "0.1.0",
  "private": true
}

Current scripts:

{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
PRE-COMMIT CHECKLIST

Before committing, run:

rm studio-2-context-snapshot.txt

git status --short

node -v
npm -v
npm run lint
npm run build

Commit only if:

- studio-2-context-snapshot.txt is removed
- .env.local is not staged
- npm run lint passes
- npm run build passes
COMMIT PLAN

If verification passes, stage the foundation files:

git add .gitignore app/globals.css app/layout.tsx package.json package-lock.json components.json components lib IMPLEMENTATION_LOG.md

Commit message:

git commit -m "chore: initialize studio-2 Next.js foundation"
THE RULES
Track every implementation step.
Do not paste secrets into chat.
Do not commit temporary diagnostic snapshots.
Do not build the full AI agent first.
Build the deterministic foundation first.
Keep files modular.
Keep implementation logs current.
Treat studio-2 as a clean Next.js rebuild, not a direct copy of studio-1 paths.
Preserve the product purpose: project recovery, system visualization, reusable asset extraction, and work-session continuity.
HISTORICAL NEXT STEP AT INITIAL SCAFFOLD

After the initial foundation commit, the next move should be:

Next Step — Build the app shell

Create the first clean application shell before feature logic:

app/
  layout.tsx
  page.tsx
components/
  layout/
    app-shell.tsx
    sidebar.tsx
    topbar.tsx
  dashboard/
    dashboard-overview.tsx

The first UI should support the MVP direction:

Project intake
System map
Work-session memory
Reusable asset library

Do not implement intelligence yet.
First make the shell coherent.

HISTORICAL STATUS AT INITIAL SCAFFOLD
studio-2 foundation: in progress
Next.js app: created
shadcn/ui: initialized
Supabase packages: installed
Supabase helper files: created
Implementation log: created
Context snapshot: completed
Initial foundation commit: pending

---

## VISUAL FOUNDATION IMPLEMENTATION — 2026-06-10

### Scope

Created a coherent visual foundation tied directly to codebase intelligence,
project recovery, system mapping, reusable asset extraction, and developer
workflow continuity. The work intentionally avoided redesigning the application
or introducing feature routes before project intake.

### Implemented Assets

- `components/brand/brand-logo.tsx`
- `components/animations/`
  - Repository scanning
  - System-map node network
  - Reusable-asset extraction
  - Project-analysis loader
  - Decorative panel ambient motion
- `public/brand/`
  - Primary light/dark logo variants
  - Compact light/dark marks
  - SVG favicon source
  - 16px, 32px, 180px, 192px, and 512px raster assets
- `public/illustrations/`
  - Homepage recovery overview
  - Empty project
  - Repository import
  - System map
  - Reusable assets
  - Current status
- `app/favicon.ico`, `app/icon.svg`, and `app/apple-icon.png`

### Integrated Surfaces

- Marketing navbar and footer use `BrandLogo`
- Dashboard sidebar uses `BrandLogo`
- Homepage hero uses `hero-system-recovery.svg`
- Dashboard intake prompt uses `PanelAmbientMotion`

The remaining illustrations and progress animations are deliberately available
but not yet integrated. They belong in the upcoming intake and scan-driven
feature surfaces.

### Accessibility and Performance

- Meaningful images expose useful alternative text
- Decorative motion is hidden from assistive technology
- All reusable animations stop under `prefers-reduced-motion: reduce`
- No runtime animation or illustration dependency was introduced
- SVG and CSS are the primary delivery formats

### Verification

```text
npm run lint          passed
npx tsc --noEmit      passed
npm run test          passed: 14 files, 117 tests
npm run build         passed
SVG validation        passed: 12 files
Browser DOM check     passed: homepage and dashboard, no console errors/warnings
```

### Serious Next Delivery Sequence

1. Confirm operational prerequisites:
   - Apply `supabase/migrations/20260609000000_create_logs.sql`
   - Decide whether log retention is required and enable it only after confirming
     `pg_cron`
2. Define the project-intake contract before UI implementation:
   - Supported source types and trust boundaries
   - Input limits and validation
   - Scan lifecycle and failure states
   - Normalized repository tree and relationship output
3. Implement `/dashboard/import` as the first real feature surface:
   - Connect/upload input
   - Explicit scan progress
   - Parsed-structure review
   - Retry and actionable failure states
4. Persist validated intake results:
   - Projects and scan runs
   - Files, routes, components, APIs, utilities, and relationships
   - Extraction provenance and scan-version identity
5. Build downstream views only from persisted, validated scan data:
   - System map
   - Reusable asset inventory
   - Current-status summary
   - Work-session continuity

The intake contract is the gating decision. Building downstream pages before
that contract exists would create speculative schemas and misleading UI.

Current implementation branch: `codex/project-intake-foundation`

---

## PROJECT INTAKE PHASE 1 — 2026-06-10

### Implemented

- Added central intake contracts, policy limits, environment gate, strict
  GitHub URL/ref validation, safe URL builders, and service-role persistence
  helpers under `lib/intake/`.
- Added a Supabase migration for `public.projects`, immutable scan identity in
  `public.scans`, RLS, minimum service-role grants, and transactional
  `public.create_project_scan(...)`.
- Added local-only `POST /api/projects/import` and
  `GET /api/scans/[scanId]` routes.
- Added `/dashboard/import` with inline validation, safe errors, queued status,
  two-second visible-page polling, existing intake visuals, and responsive
  layout.
- Corrected dashboard navigation so the active route is represented accurately.

### Intentionally Deferred

- Queue, worker, repository fetching, archive handling, source parsing,
  deterministic findings, Ollama summaries, production authorization, and
  downstream project views.
- Applying the migration to a live Supabase project.

### Verification

```text
npm run lint          passed
npx tsc --noEmit      passed
npm run test          passed: 20 files, 173 tests
npm run test:coverage passed: 92.12% statements, 86.15% branches
npm run build         passed
desktop render        passed at 1440x1000
mobile render         passed at 390x844 with no horizontal overflow
browser workflow      passed inline URL validation and safe persistence failure
```

Authoritative Supabase project `lyclwqvmbhiwlxffcnbw` is linked. The migrations
were applied with matching local/remote history, and the real API path created
and retrieved durable queued scans. A follow-up migration narrowed inherited
`service_role` grants to the minimum Phase 1 table privileges. Remote security
advisors, performance advisors, and schema lint report no issues.

### Serious Next Delivery Sequence

1. Keep migration history aligned and run security/performance advisors after
   every schema change.
2. Implement Phase 2 as a private, service-role-only queue and separate
   single-concurrency Node worker with durable events, leases, visibility
   timeout, bounded retries, terminal failure classification, and cleanup.
3. Implement Phase 3 hostile-input defenses and GitHub archive fixtures before
   downloading or extracting any repository content.
4. Implement deterministic JS/TS evidence persistence before system-map,
   reusable-asset, current-status, or AI-summary features.
