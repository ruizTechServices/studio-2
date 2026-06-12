create table if not exists public.scan_files (
  scan_id uuid not null references public.scans(id) on delete cascade,
  relative_path text not null,
  name text not null,
  extension text,
  language text,
  category text not null,
  size_bytes bigint not null,
  depth integer not null,
  is_text boolean not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  primary key (scan_id, relative_path),
  constraint scan_files_relative_path_check
    check (length(relative_path) between 1 and 512),
  constraint scan_files_name_check check (length(name) between 1 and 512),
  constraint scan_files_category_check
    check (category in ('test', 'docs', 'config', 'asset', 'source', 'other')),
  constraint scan_files_size_bytes_check check (size_bytes >= 0),
  constraint scan_files_depth_check check (depth between 1 and 35),
  constraint scan_files_content_hash_check
    check (content_hash ~ '^[0-9a-f]{64}$')
);

create index if not exists scan_files_scan_category_idx
  on public.scan_files (scan_id, category);

alter table public.scan_files enable row level security;
revoke all on table public.scan_files from public, anon, authenticated, service_role;

drop function if exists public.claim_next_scan(text, integer, integer);

create or replace function public.claim_next_scan(
  p_worker_id text,
  p_lease_seconds integer,
  p_max_attempts integer
)
returns table (
  scan_id uuid,
  project_id uuid,
  owner text,
  repository text,
  default_branch text,
  requested_ref text,
  status text,
  attempt_count integer,
  limits jsonb,
  lease_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scan public.scans%rowtype;
  v_project public.projects%rowtype;
  v_now timestamptz := now();
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$' then
    raise exception 'invalid worker id';
  end if;
  if p_lease_seconds < 15 or p_lease_seconds > 3600 then
    raise exception 'invalid lease duration';
  end if;
  if p_max_attempts < 1 or p_max_attempts > 20 then
    raise exception 'invalid maximum attempts';
  end if;

  delete from public.scan_files
  where scan_id in (
    select exhausted.id
    from public.scans as exhausted
    where exhausted.status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
      and exhausted.lease_expires_at <= v_now
      and exhausted.attempt_count >= p_max_attempts
  );

  with exhausted as (
    select candidate.id
    from public.scans as candidate
    where candidate.status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
      and candidate.lease_expires_at <= v_now
      and candidate.attempt_count >= p_max_attempts
    for update skip locked
  ),
  failed as (
    update public.scans as exhausted_scan
    set status = 'failed',
      worker_id = null,
      lease_expires_at = null,
      last_heartbeat_at = null,
      next_attempt_at = null,
      safe_error_code = 'attempts_exhausted',
      safe_error_message = 'Scan attempt limit was reached.',
      completed_at = v_now,
      updated_at = v_now
    from exhausted
    where exhausted_scan.id = exhausted.id
    returning exhausted_scan.id
  )
  insert into public.scan_events (
    scan_id, event_type, status, safe_error_code, safe_error_message
  )
  select id, 'failed', 'failed', 'attempts_exhausted',
    'Scan attempt limit was reached.'
  from failed;

  select candidate.*
  into v_scan
  from public.scans as candidate
  where (
      (
        candidate.status = 'queued'
        and coalesce(candidate.next_attempt_at, candidate.created_at) <= v_now
      )
      or (
        candidate.status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
        and candidate.lease_expires_at <= v_now
      )
    )
    and candidate.attempt_count < p_max_attempts
  order by coalesce(candidate.next_attempt_at, candidate.created_at), candidate.created_at
  for update skip locked
  limit 1;

  if v_scan.id is null then
    return;
  end if;

  delete from public.scan_files where scan_id = v_scan.id;

  update public.scans as claimed
  set status = 'validating',
    attempt_count = v_scan.attempt_count + 1,
    worker_id = p_worker_id,
    lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
    last_heartbeat_at = v_now,
    next_attempt_at = null,
    safe_error_code = null,
    safe_error_message = null,
    started_at = coalesce(v_scan.started_at, v_now),
    completed_at = null,
    updated_at = v_now
  where claimed.id = v_scan.id
  returning claimed.* into v_scan;

  select project.* into v_project
  from public.projects as project
  where project.id = v_scan.project_id;

  insert into public.scan_events (scan_id, event_type, status, worker_id, metadata)
  values (
    v_scan.id, 'claimed', v_scan.status, p_worker_id,
    jsonb_build_object('attemptCount', v_scan.attempt_count)
  );

  return query select
    v_scan.id, v_scan.project_id, v_project.owner, v_project.repository,
    v_project.default_branch, v_scan.requested_ref, v_scan.status,
    v_scan.attempt_count, v_scan.limits, v_scan.lease_expires_at;
end;
$$;

create or replace function public.transition_scan_stage(
  p_scan_id uuid,
  p_worker_id text,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  if p_status not in ('validating', 'fetching', 'extracting', 'persisting') then
    raise exception 'invalid scan stage';
  end if;

  update public.scans
  set status = p_status, updated_at = now()
  where id = p_scan_id
    and worker_id = p_worker_id
    and status in ('validating', 'fetching', 'extracting', 'persisting')
    and lease_expires_at > now();
  v_updated := found;

  if v_updated then
    insert into public.scan_events (scan_id, event_type, status, worker_id)
    values (p_scan_id, 'stage_changed', p_status, p_worker_id);
  end if;
  return v_updated;
end;
$$;

create or replace function public.begin_scan_inventory(
  p_scan_id uuid,
  p_worker_id text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.scans
    where id = p_scan_id
      and worker_id = p_worker_id
      and status = 'persisting'
      and lease_expires_at > now()
  ) then
    return false;
  end if;

  delete from public.scan_files where scan_id = p_scan_id;
  return true;
end;
$$;

create or replace function public.persist_scan_files_batch(
  p_scan_id uuid,
  p_worker_id text,
  p_files jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_files) <> 'array' then
    raise exception 'invalid inventory batch';
  end if;
  if jsonb_array_length(p_files) < 1 or jsonb_array_length(p_files) > 500 then
    raise exception 'invalid inventory batch';
  end if;
  if not exists (
    select 1 from public.scans
    where id = p_scan_id
      and worker_id = p_worker_id
      and status = 'persisting'
      and lease_expires_at > now()
  ) then
    return false;
  end if;

  insert into public.scan_files (
    scan_id, relative_path, name, extension, language, category,
    size_bytes, depth, is_text, content_hash
  )
  select
    p_scan_id,
    item->>'relativePath',
    item->>'name',
    item->>'extension',
    item->>'language',
    item->>'category',
    (item->>'sizeBytes')::bigint,
    (item->>'depth')::integer,
    (item->>'isText')::boolean,
    item->>'contentHash'
  from jsonb_array_elements(p_files) as item;
  return true;
end;
$$;

create or replace function public.finalize_phase_3_scan(
  p_scan_id uuid,
  p_project_id uuid,
  p_worker_id text,
  p_status text,
  p_default_branch text,
  p_resolved_ref text,
  p_source_commit_sha text,
  p_expected_file_count integer,
  p_statistics jsonb,
  p_warnings jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'completed_with_warnings')
    or p_source_commit_sha !~ '^[0-9a-f]{40}$'
    or p_expected_file_count < 0
    or jsonb_typeof(p_statistics) <> 'object'
    or jsonb_typeof(p_warnings) <> 'array' then
    raise exception 'invalid completion payload';
  end if;
  if not exists (
    select 1 from public.scans
    where id = p_scan_id
      and project_id = p_project_id
      and worker_id = p_worker_id
      and status = 'persisting'
      and lease_expires_at > now()
  ) or (
    select count(*) from public.scan_files where scan_id = p_scan_id
  ) <> p_expected_file_count then
    return false;
  end if;

  update public.projects
  set default_branch = p_default_branch, updated_at = now()
  where id = p_project_id;

  update public.scans
  set status = p_status,
    resolved_ref = p_resolved_ref,
    source_commit_sha = p_source_commit_sha,
    scanner_version = 'phase-3-safe-archive-intake',
    worker_id = null,
    lease_expires_at = null,
    last_heartbeat_at = null,
    next_attempt_at = null,
    statistics = p_statistics,
    warnings = p_warnings,
    safe_error_code = null,
    safe_error_message = null,
    completed_at = now(),
    updated_at = now()
  where id = p_scan_id;

  insert into public.scan_events (scan_id, event_type, status, worker_id)
  values (p_scan_id, 'completed', p_status, p_worker_id);
  return true;
end;
$$;

create or replace function public.release_scan_for_retry(
  p_scan_id uuid,
  p_worker_id text,
  p_next_attempt_at timestamptz,
  p_safe_error_code text,
  p_safe_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  delete from public.scan_files
  where scan_id = p_scan_id
    and exists (
      select 1 from public.scans
      where id = p_scan_id and worker_id = p_worker_id and lease_expires_at > now()
    );
  update public.scans
  set status = 'queued', worker_id = null, lease_expires_at = null,
    last_heartbeat_at = null, next_attempt_at = greatest(p_next_attempt_at, now()),
    safe_error_code = p_safe_error_code, safe_error_message = p_safe_error_message,
    updated_at = now()
  where id = p_scan_id and worker_id = p_worker_id
    and status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
    and lease_expires_at > now();
  v_updated := found;
  if v_updated then
    insert into public.scan_events (
      scan_id, event_type, status, worker_id, safe_error_code, safe_error_message, metadata
    ) values (
      p_scan_id, 'retry_scheduled', 'queued', p_worker_id,
      p_safe_error_code, p_safe_error_message,
      jsonb_build_object('nextAttemptAt', greatest(p_next_attempt_at, now()))
    );
  end if;
  return v_updated;
end;
$$;

create or replace function public.fail_scan(
  p_scan_id uuid,
  p_worker_id text,
  p_safe_error_code text,
  p_safe_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  delete from public.scan_files
  where scan_id = p_scan_id
    and exists (
      select 1 from public.scans
      where id = p_scan_id and worker_id = p_worker_id and lease_expires_at > now()
    );
  update public.scans
  set status = 'failed', worker_id = null, lease_expires_at = null,
    last_heartbeat_at = null, next_attempt_at = null,
    safe_error_code = p_safe_error_code, safe_error_message = p_safe_error_message,
    completed_at = now(), updated_at = now()
  where id = p_scan_id and worker_id = p_worker_id
    and status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
    and lease_expires_at > now();
  v_updated := found;
  if v_updated then
    insert into public.scan_events (
      scan_id, event_type, status, worker_id, safe_error_code, safe_error_message
    ) values (
      p_scan_id, 'failed', 'failed', p_worker_id, p_safe_error_code, p_safe_error_message
    );
  end if;
  return v_updated;
end;
$$;

revoke all on function public.claim_next_scan(text, integer, integer) from public, anon, authenticated;
revoke all on function public.transition_scan_stage(uuid, text, text) from public, anon, authenticated;
revoke all on function public.begin_scan_inventory(uuid, text) from public, anon, authenticated;
revoke all on function public.persist_scan_files_batch(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.finalize_phase_3_scan(uuid, uuid, text, text, text, text, text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.release_scan_for_retry(uuid, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.fail_scan(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.claim_next_scan(text, integer, integer) to service_role;
grant execute on function public.transition_scan_stage(uuid, text, text) to service_role;
grant execute on function public.begin_scan_inventory(uuid, text) to service_role;
grant execute on function public.persist_scan_files_batch(uuid, text, jsonb) to service_role;
grant execute on function public.finalize_phase_3_scan(uuid, uuid, text, text, text, text, text, integer, jsonb, jsonb) to service_role;
grant execute on function public.release_scan_for_retry(uuid, text, timestamptz, text, text) to service_role;
grant execute on function public.fail_scan(uuid, text, text, text) to service_role;
