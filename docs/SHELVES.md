# Shelves — Durable Reusable Asset Library (Phase 8)

Shelves turn one-off scan candidates into a permanent, cross-scan, searchable
personal library. Every repository the studio consumes can leave assets on the
shelf; the library outlives individual scans and projects.

## Concept

Phase 7 produces per-scan `scan_reusable_asset_candidates` — deterministic,
metadata-only, and ephemeral in spirit (they belong to a single scan of a
single commit). Phase 8 adds the **promotion** step: a human reviews a
candidate on the scan results page and shelves it. Promotion snapshots the
provenance and copies the deterministic metadata into `shelf_assets`, the
durable library table.

```
scan → candidates (per-scan, automatic) → [human review] → shelf (durable, curated)
```

## The pointer model (why we do not store source)

A shelf asset is a **provenance pointer**, not a code snippet:

- `source_owner` / `source_repository` / `source_canonical_url`
- `source_commit_sha` — the exact 40-hex revision the asset was seen at
- `relative_path` + `line_start`..`line_end`

This is deliberate:

1. **Security boundary** — the intake pipeline's core invariant ("source is
   parsed only in bounded worker memory and never persisted") stays intact.
   Phase 8 adds zero new source-content exposure.
2. **Licensing** — the studio never redistributes third-party code. The shelf
   records where reusable code lives; retrieval happens against the origin at
   reuse time, where the license is visible in context.
3. **Reproducibility** — the pinned commit SHA means retrieval-on-demand is
   deterministic forever, even if the upstream branch moves.

A future phase may add opt-in snippet caching for repositories the user owns;
that is an explicit boundary change and must be designed separately.

## Schema (`supabase/migrations/20260701120000_create_phase_8_shelves.sql`)

`public.shelf_assets`:

| Group | Columns |
|---|---|
| Identity | `id` (uuid), `shelf`, `asset_kind`, `symbol_name`, `symbol_kind`, `exported` |
| Provenance | `source_owner`, `source_repository`, `source_canonical_url`, `source_commit_sha`, `relative_path`, `line_start`, `line_end`, `project_id` (nullable; survives project deletion) |
| Quality | `reuse_score` (0–100), `confidence`, `reasons` (1–3) |
| Curation | `tags` (≤8, `[a-z0-9-]{1,32}`), `notes` (≤500) |
| Versioning | `version` (bumps when re-promoted at a new commit), `times_promoted` |
| Marketplace hooks | `visibility` (`private` \| `unlisted` \| `public`), `price_cents`, `published_at` — all inert until a marketplace phase lands |
| Search | `search_text` (composed at write time), `search` (generated `tsvector`, GIN-indexed) |

Dedupe key: `(source_owner, source_repository, relative_path, symbol_name,
symbol_kind)` — re-promoting the same symbol updates in place. If the commit
SHA changed, `version` increments; `times_promoted` always increments.

Access control matches the rest of the intake surface: RLS enabled, all
privileges revoked (including `service_role` table access), explicit deny-all
client policies, and access only through `security definer` RPCs granted to
`service_role`:

- `promote_reusable_asset_to_shelf(...)` — validates the candidate against a
  completed scan with a real commit SHA, joins line ranges from
  `scan_symbols`, derives the shelf from the asset kind when not given, and
  upserts. Returns the asset as camelCase jsonb, or null when the candidate,
  scan, or project no longer exists.
- `search_shelf_assets(p_query, p_shelf, p_limit ≤ 50)` — bounded lexical
  search (`websearch_to_tsquery('simple', …)` over the GIN index). Empty query
  lists most recently updated. Returns `{ total, shelfCounts, assets }`;
  `shelfCounts` respects the query but not the shelf filter so the UI can
  render facet chips.

## Code layout

| Path | Purpose |
|---|---|
| `lib/shelves/contracts.ts` | `ShelfAsset`, `ShelfSearchResult`, `PromoteShelfAssetRequest`, shelf/visibility unions |
| `lib/shelves/validation.ts` | strict request/query validation with per-field errors |
| `lib/shelves/repository.ts` | service-role RPC wrappers with full response re-validation (`parseShelfAsset`) |
| `app/api/shelves/route.ts` | `GET /api/shelves?q=&shelf=&limit=` — local-only search |
| `app/api/shelves/promote/route.ts` | `POST /api/shelves/promote` — local-only promotion (8 KiB body cap) |
| `app/dashboard/shelves/page.tsx` | server-rendered library with plain GET search form (no client JS for search) |
| `components/shelves/shelf-library-view.tsx` | presentational library grid + facet chips |
| `components/shelves/promote-candidate-button.tsx` | client button on scan-results candidate cards |

Both routes and the page are gated by `isProjectIntakeEnabled()` — production
always returns 404, exactly like the rest of the intake surface.

## Phase 9 — retrieval-on-demand (implemented)

A shelf asset's source can be previewed on demand without ever persisting it:

```
pointer lookup (RPC) → bounded fetch at pinned commit → in-memory line slice → response
```

| Piece | Purpose |
|---|---|
| `supabase/migrations/20260701233155_create_phase_9_shelf_retrieval_pointer.sql` | `get_shelf_asset_retrieval_pointer(uuid)` — service-role-only read of the provenance fields needed for retrieval |
| `lib/shelves/retrieval/contracts.ts` | `RETRIEVAL_LIMITS`, pointer/preview types, safe error codes |
| `lib/shelves/retrieval/validation.ts` | 40-hex SHA, owner/repo, and hostile-path rejection (no traversal, backslashes, absolute paths, empty segments, control characters) |
| `lib/shelves/retrieval/github-source-client.ts` | bounded fetch from `raw.githubusercontent.com` at the pinned commit — no redirects, declared + streamed byte caps, binary rejection, full-request timeout |
| `lib/shelves/retrieval/line-slicer.ts` | pure in-memory slice: clamped range, capped line count, per-line truncation |
| `lib/shelves/retrieval/repository.ts` | pointer RPC wrapper with response re-validation |
| `app/api/shelves/[assetId]/source/route.ts` | `GET /api/shelves/[assetId]/source` — local-only, `cache-control: no-store` |
| `components/shelves/source-preview-panel.tsx` | "Preview source" panel on shelf cards: pinned commit, path, line range, GitHub link, never-stored notice |

Bounds (from `RETRIEVAL_LIMITS`): 256 KiB max file size, 200 preview lines,
500 chars per line, 8 s request timeout, 40-hex commit SHAs only. The fetched
text exists only inside the route handler; logging records metadata (asset id,
line counts) and never content.

## Applying the migration

The migration is checked in but **not applied automatically**. Apply it via
Supabase Studio SQL editor or `supabase db push`, then run the security and
performance advisors, per the standing workflow.

## Roadmap (design intent, not yet built)

1. **Phase 10 — semantic search**: pgvector column on `shelf_assets`
   (`embedding vector(768)`), embeddings generated locally through the
   existing Ollama client from `search_text` + notes. Lexical FTS stays as the
   fallback and pre-filter. This is where "dark mode toggle that works with
   Tailwind" starts matching by meaning instead of tokens.
2. **Phase 11 — workspace**: new-project scaffolding plus an asset palette
   that drops shelf assets into a working tree via retrieval-on-demand, with
   provenance comments stamped at insertion.
3. **Phase 12 — marketplace**: the `visibility` / `price_cents` /
   `published_at` columns activate. Requires auth (per-user `owner_id`),
   Stripe, and a licensing/attribution policy for anything non-`private`.
   Until then, everything is `private` and constraint-enforced.

## Vercel deployment notes

- The intake/shelf surface is production-hidden by design
  (`PROJECT_INTAKE_ENABLED` is only honored outside production), so deploying
  to Vercel exposes nothing — routes 404.
- The scan worker (`npm run worker:intake`) is a long-lived process and does
  **not** run on Vercel; it runs on a machine you control against the same
  Supabase project.
- All Supabase clients are request-scoped (Fluid compute safe); no changes
  needed for Vercel's runtime.
- When the workspace/marketplace phases make shelves user-facing, the gate
  moves from environment-based to auth-based (Supabase Auth + per-user RLS on
  `shelf_assets` via an `owner_id` column) — that is the prerequisite for any
  public deployment of this surface.
