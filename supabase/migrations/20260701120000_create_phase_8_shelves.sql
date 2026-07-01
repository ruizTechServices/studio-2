-- Phase 8: Shelves — durable, cross-scan reusable asset library.
-- Shelf assets are provenance pointers (owner/repo/commit/path/lines) plus
-- deterministic metadata. Source contents are never persisted; retrieval
-- happens on demand at reuse time against the pinned commit.

create table if not exists public.shelf_assets (
  id uuid primary key default gen_random_uuid(),
  shelf text not null,
  asset_kind text not null,
  symbol_name text not null,
  symbol_kind text not null,
  exported boolean not null,
  source_owner text not null,
  source_repository text not null,
  source_canonical_url text not null,
  source_commit_sha text not null,
  relative_path text not null,
  line_start integer,
  line_end integer,
  project_id uuid references public.projects(id) on delete set null,
  reuse_score integer not null,
  confidence text not null,
  reasons jsonb not null,
  tags jsonb not null default '[]'::jsonb,
  notes text,
  visibility text not null default 'private',
  price_cents integer,
  published_at timestamptz,
  version integer not null default 1,
  times_promoted integer not null default 1,
  search_text text not null,
  search tsvector generated always as (to_tsvector('simple', search_text)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shelf_assets_unique
    unique (source_owner, source_repository, relative_path, symbol_name, symbol_kind),
  constraint shelf_assets_shelf_check
    check (shelf in ('components', 'hooks', 'utilities', 'api', 'types', 'config', 'constants', 'misc')),
  constraint shelf_assets_asset_kind_check
    check (asset_kind in ('ui_component', 'hook', 'utility', 'api_handler', 'type_definition', 'config_helper', 'constant', 'unknown')),
  constraint shelf_assets_symbol_kind_check
    check (symbol_kind in ('function', 'component', 'hook', 'api_handler', 'type', 'constant', 'unknown')),
  constraint shelf_assets_symbol_name_check
    check (length(symbol_name) between 1 and 512),
  constraint shelf_assets_relative_path_check
    check (length(relative_path) between 1 and 512),
  constraint shelf_assets_source_owner_check
    check (length(source_owner) between 1 and 39),
  constraint shelf_assets_source_repository_check
    check (length(source_repository) between 1 and 100),
  constraint shelf_assets_commit_sha_check
    check (source_commit_sha ~ '^[0-9a-f]{40}$'),
  constraint shelf_assets_lines_check
    check ((line_start is null and line_end is null) or (line_start >= 1 and line_end >= line_start)),
  constraint shelf_assets_confidence_check
    check (confidence in ('high', 'medium', 'low')),
  constraint shelf_assets_score_check
    check (reuse_score between 0 and 100),
  constraint shelf_assets_reasons_check
    check (jsonb_typeof(reasons) = 'array' and jsonb_array_length(reasons) between 1 and 3),
  constraint shelf_assets_tags_check
    check (jsonb_typeof(tags) = 'array' and jsonb_array_length(tags) between 0 and 8),
  constraint shelf_assets_notes_check
    check (notes is null or length(notes) between 1 and 500),
  constraint shelf_assets_visibility_check
    check (visibility in ('private', 'unlisted', 'public')),
  constraint shelf_assets_price_check
    check (price_cents is null or price_cents >= 0),
  constraint shelf_assets_marketplace_check
    check (visibility <> 'private' or (price_cents is null and published_at is null)),
  constraint shelf_assets_version_check
    check (version >= 1 and times_promoted >= 1),
  constraint shelf_assets_search_text_check
    check (length(search_text) between 1 and 4000)
);

create index if not exists shelf_assets_search_idx
  on public.shelf_assets using gin (search);
create index if not exists shelf_assets_browse_idx
  on public.shelf_assets (shelf, updated_at desc);
create index if not exists shelf_assets_project_id_idx
  on public.shelf_assets (project_id);

alter table public.shelf_assets enable row level security;
revoke all on table public.shelf_assets from public, anon, authenticated, service_role;

create policy "shelf_assets_no_client_access"
  on public.shelf_assets
  for all
  to anon, authenticated
  using (false)
  with check (false);

create or replace function public.shelf_asset_to_jsonb(asset public.shelf_assets)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', asset.id,
    'shelf', asset.shelf,
    'assetKind', asset.asset_kind,
    'symbolName', asset.symbol_name,
    'symbolKind', asset.symbol_kind,
    'exported', asset.exported,
    'sourceOwner', asset.source_owner,
    'sourceRepository', asset.source_repository,
    'sourceCanonicalUrl', asset.source_canonical_url,
    'sourceCommitSha', asset.source_commit_sha,
    'relativePath', asset.relative_path,
    'lineStart', asset.line_start,
    'lineEnd', asset.line_end,
    'projectId', asset.project_id,
    'reuseScore', asset.reuse_score,
    'confidence', asset.confidence,
    'reasons', asset.reasons,
    'tags', asset.tags,
    'notes', asset.notes,
    'visibility', asset.visibility,
    'version', asset.version,
    'timesPromoted', asset.times_promoted,
    'createdAt', asset.created_at,
    'updatedAt', asset.updated_at
  )
$$;

-- Promotes one deterministic reusable-asset candidate into the durable shelf
-- library. Provenance is snapshotted from the completed scan so the shelf
-- entry survives project deletion. Re-promoting the same symbol from a newer
-- commit bumps the version.
create or replace function public.promote_reusable_asset_to_shelf(
  p_scan_id uuid,
  p_project_id uuid,
  p_relative_path text,
  p_symbol_name text,
  p_symbol_kind text,
  p_shelf text,
  p_tags jsonb,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_scan record;
  v_project record;
  v_line_start integer;
  v_line_end integer;
  v_shelf text;
  v_tag_text text;
  v_search_text text;
  v_asset public.shelf_assets;
begin
  if jsonb_typeof(p_tags) <> 'array' or jsonb_array_length(p_tags) > 8 then
    raise exception 'invalid shelf tags';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_tags) as tag
    where jsonb_typeof(tag) <> 'string'
      or tag #>> '{}' !~ '^[a-z0-9][a-z0-9-]{0,31}$'
  ) then
    raise exception 'invalid shelf tags';
  end if;
  if p_notes is not null and length(p_notes) not between 1 and 500 then
    raise exception 'invalid shelf notes';
  end if;
  if p_shelf is not null and p_shelf not in
    ('components', 'hooks', 'utilities', 'api', 'types', 'config', 'constants', 'misc') then
    raise exception 'invalid shelf name';
  end if;

  select * into v_candidate
  from public.scan_reusable_asset_candidates
  where scan_id = p_scan_id
    and project_id = p_project_id
    and relative_path = p_relative_path
    and symbol_name = p_symbol_name
    and symbol_kind = p_symbol_kind;
  if not found then
    return null;
  end if;

  select id, source_commit_sha into v_scan
  from public.scans
  where id = p_scan_id
    and project_id = p_project_id
    and status in ('completed', 'completed_with_warnings')
    and source_commit_sha ~ '^[0-9a-f]{40}$';
  if not found then
    return null;
  end if;

  select owner, repository, canonical_url into v_project
  from public.projects
  where id = p_project_id;
  if not found then
    return null;
  end if;

  select line_start, line_end into v_line_start, v_line_end
  from public.scan_symbols
  where scan_id = p_scan_id
    and relative_path = p_relative_path
    and name = p_symbol_name
    and kind = p_symbol_kind
  order by line_start nulls last
  limit 1;

  v_shelf := coalesce(p_shelf, case v_candidate.asset_kind
    when 'ui_component' then 'components'
    when 'hook' then 'hooks'
    when 'utility' then 'utilities'
    when 'api_handler' then 'api'
    when 'type_definition' then 'types'
    when 'config_helper' then 'config'
    when 'constant' then 'constants'
    else 'misc'
  end);

  select coalesce(string_agg(tag #>> '{}', ' '), '')
  into v_tag_text
  from jsonb_array_elements(p_tags) as tag;

  v_search_text := left(lower(concat_ws(' ',
    p_symbol_name,
    replace(p_relative_path, '/', ' '),
    replace(v_candidate.asset_kind, '_', ' '),
    v_shelf,
    v_project.owner,
    v_project.repository,
    v_tag_text,
    coalesce(p_notes, '')
  )), 4000);

  insert into public.shelf_assets (
    shelf, asset_kind, symbol_name, symbol_kind, exported,
    source_owner, source_repository, source_canonical_url, source_commit_sha,
    relative_path, line_start, line_end, project_id,
    reuse_score, confidence, reasons, tags, notes, search_text
  )
  values (
    v_shelf, v_candidate.asset_kind, p_symbol_name, p_symbol_kind, v_candidate.exported,
    v_project.owner, v_project.repository, v_project.canonical_url, v_scan.source_commit_sha,
    p_relative_path, v_line_start, v_line_end, p_project_id,
    v_candidate.reuse_score, v_candidate.confidence, v_candidate.reasons, p_tags, p_notes, v_search_text
  )
  on conflict (source_owner, source_repository, relative_path, symbol_name, symbol_kind) do update
  set version = public.shelf_assets.version
      + case when public.shelf_assets.source_commit_sha <> excluded.source_commit_sha then 1 else 0 end,
    times_promoted = public.shelf_assets.times_promoted + 1,
    shelf = excluded.shelf,
    asset_kind = excluded.asset_kind,
    exported = excluded.exported,
    source_canonical_url = excluded.source_canonical_url,
    source_commit_sha = excluded.source_commit_sha,
    line_start = excluded.line_start,
    line_end = excluded.line_end,
    project_id = excluded.project_id,
    reuse_score = excluded.reuse_score,
    confidence = excluded.confidence,
    reasons = excluded.reasons,
    tags = excluded.tags,
    notes = excluded.notes,
    search_text = excluded.search_text,
    updated_at = now()
  returning * into v_asset;

  return public.shelf_asset_to_jsonb(v_asset);
end;
$$;

-- Bounded lexical search over the shelf library. Empty query lists the most
-- recently updated assets. shelfCounts facets respect the query but not the
-- shelf filter so the UI can render facet chips.
create or replace function public.search_shelf_assets(
  p_query text,
  p_shelf text,
  p_limit integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_query tsquery;
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'invalid shelf search limit';
  end if;
  if p_query is not null and length(p_query) > 160 then
    raise exception 'invalid shelf search query';
  end if;
  if p_shelf is not null and p_shelf not in
    ('components', 'hooks', 'utilities', 'api', 'types', 'config', 'constants', 'misc') then
    raise exception 'invalid shelf name';
  end if;

  if p_query is not null and length(btrim(p_query)) > 0 then
    v_query := websearch_to_tsquery('simple', p_query);
  end if;

  return jsonb_build_object(
    'total', (
      select count(*)
      from public.shelf_assets
      where (v_query is null or search @@ v_query)
        and (p_shelf is null or shelf = p_shelf)
    ),
    'shelfCounts', (
      select coalesce(jsonb_object_agg(counts.shelf, counts.total), '{}'::jsonb)
      from (
        select shelf, count(*) as total
        from public.shelf_assets
        where (v_query is null or search @@ v_query)
        group by shelf
      ) as counts
    ),
    'assets', coalesce((
      select jsonb_agg(public.shelf_asset_to_jsonb(asset))
      from (
        select *
        from public.shelf_assets
        where (v_query is null or search @@ v_query)
          and (p_shelf is null or shelf = p_shelf)
        order by
          case when v_query is null then 0 else ts_rank(search, v_query) end desc,
          reuse_score desc,
          updated_at desc,
          id
        limit p_limit
      ) as asset
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.shelf_asset_to_jsonb(public.shelf_assets)
  from public, anon, authenticated;
revoke all on function public.promote_reusable_asset_to_shelf(uuid, uuid, text, text, text, text, jsonb, text)
  from public, anon, authenticated;
revoke all on function public.search_shelf_assets(text, text, integer)
  from public, anon, authenticated;
grant execute on function public.promote_reusable_asset_to_shelf(uuid, uuid, text, text, text, text, jsonb, text) to service_role;
grant execute on function public.search_shelf_assets(text, text, integer) to service_role;
