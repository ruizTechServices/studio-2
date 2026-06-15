create table if not exists public.scan_reusable_asset_candidates (
  id bigint generated always as identity primary key,
  scan_id uuid not null references public.scans(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  relative_path text not null,
  symbol_name text not null,
  symbol_kind text not null,
  asset_kind text not null,
  exported boolean not null,
  confidence text not null,
  reuse_score integer not null,
  reasons jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (scan_id, relative_path)
    references public.scan_files(scan_id, relative_path) on delete cascade,
  constraint scan_reusable_asset_candidates_unique
    unique (scan_id, relative_path, symbol_name, symbol_kind),
  constraint scan_reusable_asset_candidates_symbol_name_check
    check (length(symbol_name) between 1 and 512),
  constraint scan_reusable_asset_candidates_symbol_kind_check
    check (symbol_kind in ('function', 'component', 'hook', 'api_handler', 'type', 'constant', 'unknown')),
  constraint scan_reusable_asset_candidates_asset_kind_check
    check (asset_kind in ('ui_component', 'hook', 'utility', 'api_handler', 'type_definition', 'config_helper', 'constant', 'unknown')),
  constraint scan_reusable_asset_candidates_confidence_check
    check (confidence in ('high', 'medium', 'low')),
  constraint scan_reusable_asset_candidates_score_check
    check (reuse_score between 0 and 100),
  constraint scan_reusable_asset_candidates_reasons_check
    check (jsonb_typeof(reasons) = 'array' and jsonb_array_length(reasons) between 1 and 3)
);

create index if not exists scan_reusable_asset_candidates_order_idx
  on public.scan_reusable_asset_candidates
  (scan_id, reuse_score desc, confidence, relative_path, symbol_name);

alter table public.scan_reusable_asset_candidates enable row level security;
revoke all on table public.scan_reusable_asset_candidates from public, anon, authenticated, service_role;
revoke all on sequence public.scan_reusable_asset_candidates_id_seq from public, anon, authenticated, service_role;

create or replace function public.persist_scan_reusable_asset_candidates_batch(
  p_scan_id uuid,
  p_worker_id text,
  p_candidates jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
begin
  if jsonb_typeof(p_candidates) <> 'array'
    or jsonb_array_length(p_candidates) < 1
    or jsonb_array_length(p_candidates) > 500 then
    raise exception 'invalid reusable asset candidate batch';
  end if;

  select project_id into v_project_id
  from public.scans
  where id = p_scan_id
    and worker_id = p_worker_id
    and status = 'persisting'
    and lease_expires_at > now()
  for update;
  if v_project_id is null then
    return false;
  end if;

  insert into public.scan_reusable_asset_candidates (
    scan_id, project_id, relative_path, symbol_name, symbol_kind, asset_kind,
    exported, confidence, reuse_score, reasons
  )
  select
    p_scan_id,
    v_project_id,
    item->>'relativePath',
    item->>'symbolName',
    item->>'symbolKind',
    item->>'assetKind',
    (item->>'exported')::boolean,
    item->>'confidence',
    (item->>'reuseScore')::integer,
    item->'reasons'
  from jsonb_array_elements(p_candidates) as item
  on conflict (scan_id, relative_path, symbol_name, symbol_kind) do update
  set asset_kind = excluded.asset_kind,
    exported = excluded.exported,
    confidence = excluded.confidence,
    reuse_score = excluded.reuse_score,
    reasons = excluded.reasons;
  return true;
end;
$$;

create or replace function public.finalize_phase_7_scan(
  p_scan_id uuid,
  p_project_id uuid,
  p_worker_id text,
  p_status text,
  p_default_branch text,
  p_resolved_ref text,
  p_source_commit_sha text,
  p_expected_file_count integer,
  p_expected_symbol_count integer,
  p_expected_candidate_count integer,
  p_statistics jsonb,
  p_warnings jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scan_id uuid;
begin
  if p_status not in ('completed', 'completed_with_warnings')
    or p_source_commit_sha !~ '^[0-9a-f]{40}$'
    or p_expected_file_count < 0
    or p_expected_symbol_count < 0
    or p_expected_candidate_count < 0
    or p_expected_candidate_count > 5000
    or jsonb_typeof(p_statistics) <> 'object'
    or jsonb_typeof(p_warnings) <> 'array' then
    raise exception 'invalid completion payload';
  end if;

  select id into v_scan_id
  from public.scans
  where id = p_scan_id
    and project_id = p_project_id
    and worker_id = p_worker_id
    and status = 'persisting'
    and lease_expires_at > now()
  for update;

  if v_scan_id is null
    or (select count(*) from public.scan_files where scan_id = p_scan_id) <> p_expected_file_count
    or (select count(*) from public.scan_symbols where scan_id = p_scan_id) <> p_expected_symbol_count
    or (select count(*) from public.scan_reusable_asset_candidates where scan_id = p_scan_id) <> p_expected_candidate_count then
    return false;
  end if;

  update public.scans
  set status = p_status,
    resolved_ref = p_resolved_ref,
    source_commit_sha = p_source_commit_sha,
    scanner_version = 'phase-7-reusable-asset-candidates',
    worker_id = null,
    lease_expires_at = null,
    last_heartbeat_at = null,
    next_attempt_at = null,
    statistics = p_statistics || jsonb_build_object(
      'symbolsDiscovered', p_expected_symbol_count,
      'reusableAssetCandidates', p_expected_candidate_count
    ),
    warnings = p_warnings,
    safe_error_code = null,
    safe_error_message = null,
    completed_at = now(),
    updated_at = now()
  where id = p_scan_id
    and project_id = p_project_id
    and worker_id = p_worker_id
    and status = 'persisting'
    and lease_expires_at > now();
  if not found then return false; end if;

  update public.projects
  set default_branch = p_default_branch, updated_at = now()
  where id = p_project_id;

  insert into public.scan_events (scan_id, event_type, status, worker_id, metadata)
  values (
    p_scan_id, 'completed', p_status, p_worker_id,
    jsonb_build_object('symbolCount', p_expected_symbol_count, 'candidateCount', p_expected_candidate_count)
  );
  return true;
end;
$$;

create or replace function public.get_scan_reusable_asset_summary(
  p_project_id uuid,
  p_scan_id uuid,
  p_preview_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_preview_limit < 0 or p_preview_limit > 25 then
    raise exception 'invalid preview limit';
  end if;
  if not exists (
    select 1 from public.scans where id = p_scan_id and project_id = p_project_id
  ) then
    return null;
  end if;

  return jsonb_build_object(
    'total', (select count(*) from public.scan_reusable_asset_candidates where scan_id = p_scan_id),
    'preview', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scanId', candidate.scan_id,
        'projectId', candidate.project_id,
        'relativePath', candidate.relative_path,
        'symbolName', candidate.symbol_name,
        'symbolKind', candidate.symbol_kind,
        'assetKind', candidate.asset_kind,
        'exported', candidate.exported,
        'confidence', candidate.confidence,
        'reuseScore', candidate.reuse_score,
        'reasons', candidate.reasons
      ) order by candidate.reuse_score desc,
        case candidate.confidence when 'high' then 0 when 'medium' then 1 else 2 end,
        candidate.relative_path, candidate.symbol_name)
      from (
        select *
        from public.scan_reusable_asset_candidates
        where scan_id = p_scan_id
        order by reuse_score desc,
          case confidence when 'high' then 0 when 'medium' then 1 else 2 end,
          relative_path, symbol_name
        limit p_preview_limit
      ) as candidate
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.persist_scan_reusable_asset_candidates_batch(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.finalize_phase_7_scan(uuid, uuid, text, text, text, text, text, integer, integer, integer, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_scan_reusable_asset_summary(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.persist_scan_reusable_asset_candidates_batch(uuid, text, jsonb) to service_role;
grant execute on function public.finalize_phase_7_scan(uuid, uuid, text, text, text, text, text, integer, integer, integer, jsonb, jsonb) to service_role;
grant execute on function public.get_scan_reusable_asset_summary(uuid, uuid, integer) to service_role;
