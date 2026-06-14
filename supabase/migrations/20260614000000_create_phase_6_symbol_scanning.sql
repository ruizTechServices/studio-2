create table if not exists public.scan_symbols (
  id bigint generated always as identity primary key,
  scan_id uuid not null,
  relative_path text not null,
  kind text not null,
  name text not null,
  exported boolean not null,
  import_source text,
  line_start integer,
  line_end integer,
  confidence text not null,
  category text not null,
  created_at timestamptz not null default now(),
  foreign key (scan_id, relative_path)
    references public.scan_files(scan_id, relative_path) on delete cascade,
  constraint scan_symbols_kind_check check (
    kind in ('import', 'export', 'function', 'component', 'hook', 'api_handler', 'type', 'constant', 'unknown')
  ),
  constraint scan_symbols_name_check check (length(name) between 1 and 512),
  constraint scan_symbols_import_source_check check (
    import_source is null or length(import_source) between 1 and 512
  ),
  constraint scan_symbols_lines_check check (
    (line_start is null and line_end is null)
    or (line_start >= 1 and line_end >= line_start)
  ),
  constraint scan_symbols_confidence_check check (confidence in ('high', 'medium', 'low')),
  constraint scan_symbols_category_check check (
    category in ('dependency', 'declaration', 'routing', 'unknown')
  )
);

create index if not exists scan_symbols_scan_kind_idx
  on public.scan_symbols (scan_id, kind);
create index if not exists scan_symbols_scan_path_idx
  on public.scan_symbols (scan_id, relative_path);

alter table public.scan_symbols enable row level security;
revoke all on table public.scan_symbols from public, anon, authenticated, service_role;
revoke all on sequence public.scan_symbols_id_seq from public, anon, authenticated, service_role;

create or replace function public.persist_scan_symbols_batch(
  p_scan_id uuid,
  p_worker_id text,
  p_symbols jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scan_id uuid;
begin
  if jsonb_typeof(p_symbols) <> 'array'
    or jsonb_array_length(p_symbols) < 1
    or jsonb_array_length(p_symbols) > 500 then
    raise exception 'invalid symbol batch';
  end if;

  select id into v_scan_id
  from public.scans
  where id = p_scan_id
    and worker_id = p_worker_id
    and status = 'persisting'
    and lease_expires_at > now()
  for update;
  if v_scan_id is null then
    return false;
  end if;

  insert into public.scan_symbols (
    scan_id, relative_path, kind, name, exported, import_source,
    line_start, line_end, confidence, category
  )
  select
    p_scan_id,
    item->>'relativePath',
    item->>'kind',
    item->>'name',
    (item->>'exported')::boolean,
    item->>'importSource',
    nullif(item->>'lineStart', '')::integer,
    nullif(item->>'lineEnd', '')::integer,
    item->>'confidence',
    item->>'category'
  from jsonb_array_elements(p_symbols) as item;
  return true;
end;
$$;

create or replace function public.finalize_phase_6_scan(
  p_scan_id uuid,
  p_project_id uuid,
  p_worker_id text,
  p_status text,
  p_default_branch text,
  p_resolved_ref text,
  p_source_commit_sha text,
  p_expected_file_count integer,
  p_expected_symbol_count integer,
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
    or (select count(*) from public.scan_symbols where scan_id = p_scan_id) <> p_expected_symbol_count then
    return false;
  end if;

  update public.scans
  set status = p_status,
    resolved_ref = p_resolved_ref,
    source_commit_sha = p_source_commit_sha,
    scanner_version = 'phase-6-deterministic-js-ts-symbols',
    worker_id = null,
    lease_expires_at = null,
    last_heartbeat_at = null,
    next_attempt_at = null,
    statistics = p_statistics || jsonb_build_object('symbolsDiscovered', p_expected_symbol_count),
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
  if not found then
    return false;
  end if;

  update public.projects
  set default_branch = p_default_branch, updated_at = now()
  where id = p_project_id;

  insert into public.scan_events (scan_id, event_type, status, worker_id, metadata)
  values (
    p_scan_id, 'completed', p_status, p_worker_id,
    jsonb_build_object('symbolCount', p_expected_symbol_count)
  );
  return true;
end;
$$;

create or replace function public.get_scan_symbol_summary(
  p_project_id uuid,
  p_scan_id uuid,
  p_preview_limit integer default 25
)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_result jsonb;
begin
  if p_preview_limit < 0 or p_preview_limit > 50 then
    raise exception 'invalid preview limit';
  end if;
  if not exists (
    select 1 from public.scans
    where id = p_scan_id and project_id = p_project_id
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'total', (select count(*) from public.scan_symbols where scan_id = p_scan_id),
    'counts', jsonb_build_object(
      'import', count(*) filter (where kind = 'import'),
      'export', count(*) filter (where kind = 'export'),
      'function', count(*) filter (where kind = 'function'),
      'component', count(*) filter (where kind = 'component'),
      'hook', count(*) filter (where kind = 'hook'),
      'api_handler', count(*) filter (where kind = 'api_handler'),
      'type', count(*) filter (where kind = 'type'),
      'constant', count(*) filter (where kind = 'constant'),
      'unknown', count(*) filter (where kind = 'unknown')
    ),
    'preview', coalesce((
      select jsonb_agg(jsonb_build_object(
        'relativePath', preview.relative_path,
        'kind', preview.kind,
        'name', preview.name,
        'exported', preview.exported,
        'importSource', preview.import_source,
        'lineStart', preview.line_start,
        'lineEnd', preview.line_end,
        'confidence', preview.confidence,
        'category', preview.category
      ) order by preview.relative_path, preview.line_start nulls last, preview.kind, preview.name)
      from (
        select relative_path, kind, name, exported, import_source,
          line_start, line_end, confidence, category
        from public.scan_symbols
        where scan_id = p_scan_id
        order by relative_path, line_start nulls last, kind, name
        limit p_preview_limit
      ) as preview
    ), '[]'::jsonb)
  )
  into v_result
  from public.scan_symbols
  where scan_id = p_scan_id;
  return v_result;
end;
$$;

revoke all on function public.persist_scan_symbols_batch(uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.finalize_phase_6_scan(uuid, uuid, text, text, text, text, text, integer, integer, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.get_scan_symbol_summary(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.persist_scan_symbols_batch(uuid, text, jsonb) to service_role;
grant execute on function public.finalize_phase_6_scan(uuid, uuid, text, text, text, text, text, integer, integer, jsonb, jsonb) to service_role;
grant execute on function public.get_scan_symbol_summary(uuid, uuid, integer) to service_role;
