# Code Review — studio-2

**Date:** 2026-06-11 · **Scope:** modularity, separation of concerns, security · **Mode:** read-only review

Reviewed: all 5 API routes, `lib/server.ts`, `lib/middleware.ts`, `lib/client.ts`, `lib/intake/*` (validation, policy, repository, github-url, worker), `lib/logger/*` (server, client, sanitize), `lib/ai/*` (model-policy, ollama-client), all 4 Supabase migrations, `.gitignore`, git-tracked files. Skipped: `node_modules`, `.next`, `coverage`, tests (sampled only).

---

## Findings (ranked by severity)

### 🔴 HIGH-1: Auth middleware is dead code — the entire app is unauthenticated

**File:** `lib/middleware.ts` (exists) vs. project root (no `middleware.ts`)

`lib/middleware.ts` contains a complete `updateSession()` auth gate (session refresh + redirect to `/auth/login`), but Next.js only executes middleware from a root-level `middleware.ts` / `src/middleware.ts`. **That file does not exist.** Result: no route — page or API — performs any authentication. There is also no `/auth/login` page to redirect to, so it was never wired up.

**Fix:** Create root `middleware.ts` that calls `updateSession()` with a proper `matcher` config, and build the auth pages — or, if pre-auth is intentional for this phase, document that explicitly in `AGENTS.md` and gate deployment. Don't leave a security control that silently doesn't run.

---

### 🔴 HIGH-2: `/api/ai/chat` is unauthenticated with no rate limiting — open GPU proxy

**File:** `app/api/ai/chat/route.ts:69-154`

Anyone who can reach the deployment can drive your Ollama GPU box: up to 200 messages × 20K chars per request (`lib/ai/model-policy.ts:20-25`), 550KB bodies, no auth check, no rate limit, no per-IP throttle (`grep -ri rate` → zero hits in `app/` and `lib/`). This is cost/abuse/DoS exposure, and the endpoint returns full model output — a free inference API.

**Fix:** Require an authenticated Supabase session (check `auth.getClaims()` like `app/api/log/route.ts:27-36` already does) and add rate limiting (Upstash Ratelimit, or a Postgres-based counter via your existing service-role client). At minimum, gate it behind an env flag like intake does (`isProjectIntakeEnabled` pattern in `lib/intake/policy.ts:24-31`).

---

### 🟠 MEDIUM-1: `/api/log` allows unauthenticated, unlimited DB writes

**File:** `app/api/log/route.ts:42-110`

The endpoint validates and sanitizes well (genuinely good work in `lib/logger/sanitize.ts`), but any anonymous client can insert rows into `public.logs` indefinitely → storage-exhaustion / log-flooding vector, and noisy data pollutes a table your tooling presumably trusts. Also `inferRoute()` (line 13-25) trusts the attacker-controlled `Referer` header, so the `route` column is spoofable.

**Fix:** Rate-limit per IP, consider requiring auth (or at least heavily throttling anon), and treat `route` as untrusted display data. The retention script (`supabase/sql/enable_logs_retention.sql`) helps but doesn't prevent burst abuse.

---

### 🟠 MEDIUM-2: `/api/scans/[scanId]` — bearer-by-UUID access, no ownership model

**File:** `app/api/scans/[scanId]/route.ts:15-48`, `lib/intake/repository.ts:82-125`

Any holder (or lucky guesser) of a scan UUID reads its status via the service-role client — no user/ownership column exists on `projects`/`scans`. UUIDv4 entropy plus the prod kill-switch (`isProjectIntakeEnabled` returns false when `NODE_ENV === 'production'`) makes this acceptable *today*, but it's a latent IDOR the moment intake ships to prod or scan results contain repo analysis data.

**Fix:** Add `owner_user_id` to `projects` in the Phase 3 migration and filter scan reads by the authenticated user. Flagging now so it lands in the schema before data accumulates.

---

### 🟡 LOW-1: `OLLAMA_DEFAULT_MODEL` from env bypasses the allowlist

**File:** `lib/ai/model-policy.ts:17-19`

`DEFAULT_MODEL = process.env.OLLAMA_DEFAULT_MODEL ?? ALLOWED_MODELS[0]` — request-supplied models are checked against `ALLOWED_MODELS`, but the env-supplied default isn't. A typo'd or unvetted env value flows straight to Ollama.

**Fix:** Validate the env value against `ALLOWED_MODELS` at module load; fall back to `ALLOWED_MODELS[0]` with a warning.

---

### 🟡 LOW-2: Unencoded path segments in GitHub URL builder

**File:** `lib/intake/github-url.ts:3-8`

`buildGitHubApiRepositoryUrl` interpolates `owner`/`repository` without `encodeURIComponent` (the archive builder does encode `ref`). The strict regex in `lib/intake/validation.ts:6-7` makes this currently unexploitable, but it's a single-regex-change away from URL injection.

**Fix:** Encode both segments anyway — defense in depth, two tokens of cost.

---

### 🟡 LOW-3: `lib/server.ts` mixes anon and service-role clients; no `server-only` guard

**File:** `lib/server.ts:40-55`

The service-role factory lives beside the cookie-based SSR client. `next/headers` makes the file server-only in practice, but an `import 'server-only'` declaration would turn an accidental client-side import of `createServiceRoleClient` into a build error instead of a leaked-key incident. Also a minor SoC nit: privileged and unprivileged client factories deserve separate modules (`lib/supabase/server.ts` vs `lib/supabase/admin.ts`).

---

### 🟡 LOW-4: Duplicated request-parsing boilerplate across routes (modularity)

**Files:** `app/api/log/route.ts:43-72`, `app/api/ai/chat/route.ts:70-100`, `app/api/projects/import/route.ts:21-50`

The same ~30-line block (content-type check → content-length check → read text → byte-size recheck → JSON.parse) is copy-pasted three times with only `MAX_BODY_BYTES` and error formatting varying. A bug fix in one won't propagate.

**Fix:** Extract `lib/http/read-json-body.ts` returning a discriminated union (`{ok: true, value} | {ok: false, status, error}`). Same for the duplicated prod-debug-suppression check, which appears in `lib/logger/server.ts:26`, `lib/logger/client.ts:29`, and `app/api/log/route.ts:88`.

---

### 🟡 LOW-5: Synchronous `await logInfo(...)` adds DB-write latency to chat responses

**File:** `app/api/ai/chat/route.ts:116-135`

The success path awaits a Supabase insert before responding. `app/api/log/route.ts:96` already uses `after()` for exactly this reason — apply the same pattern here.

---

## What's done well (worth keeping)

- **Modularity is strong overall.** `lib/intake`, `lib/logger`, `lib/ai` are cleanly layered: contracts → validation → policy → repository → route. Routes contain zero business logic. Worker (`lib/intake/worker/`) separates config/contracts/failures/repository/runner properly.
- **Database privilege model is excellent.** Every table: RLS enabled, `revoke all from public/anon/authenticated`, narrow service-role grants tightened further in `20260610233821_restrict_phase_1_service_role_grants.sql`. Worker access is RPC-only with explicit revokes.
- **Secrets hygiene checks out.** `.env.local` is gitignored and not git-tracked; `supabase/.temp/` not tracked; no hardcoded keys found in source; service-role key never touches `NEXT_PUBLIC_*`.
- **Input validation is rigorous** — strict GitHub URL regex with double-hyphen/`.git`/dot-segment rejection, git-ref control-char filtering, UUID checks, model allowlist, byte-accurate body limits with declared-vs-actual length recheck.
- **Log sanitizer** (`lib/logger/sanitize.ts`) covers key-based and pattern-based redaction including JWTs.

---

## TL;DR

Architecture and modularity: genuinely solid — clean layering, strict validation, locked-down RLS, no leaked secrets. The two real problems are both **auth**: (1) the auth middleware was written but never wired into a root `middleware.ts`, so it never runs and the whole app is open; (2) `/api/ai/chat` and `/api/log` are unauthenticated with zero rate limiting — a free GPU inference proxy and a DB-flooding vector respectively. Fix those two before any public deployment; everything else is polish (extract shared body-parsing helper, encode URL segments, allowlist-check the default model, add `server-only` to `lib/server.ts`, ownership column on `projects` before Phase 3).
