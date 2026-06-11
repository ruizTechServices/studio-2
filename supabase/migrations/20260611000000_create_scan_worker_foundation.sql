alter table public.scans
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz;

create table if not exists public.scan_events (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  event_type text not null,
  status text not null,
  worker_id text,
  safe_error_code text,
  safe_error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint scan_events_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists scans_queue_eligibility_idx
  on public.scans (next_attempt_at, created_at)
  where status = 'queued';
create index if not exists scans_active_lease_idx
  on public.scans (lease_expires_at)
  where status in (
    'fetching',
    'validating',
    'extracting',
    'parsing',
    'persisting'
  );
create index if not exists scan_events_scan_created_at_idx
  on public.scan_events (scan_id, created_at);

alter table public.scan_events enable row level security;

revoke all on table public.scan_events from public, anon, authenticated;
revoke all on table public.scan_events from service_role;
grant insert on table public.scan_events to service_role;

revoke all on table public.scans from service_role;
grant select, insert, update on table public.scans to service_role;

create or replace function public.create_project_scan(
  p_owner text,
  p_repository text,
  p_canonical_url text,
  p_requested_ref text,
  p_limits jsonb
)
returns table (
  project_id uuid,
  scan_id uuid,
  status text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_scan_id uuid;
begin
  insert into public.projects (
    provider,
    owner,
    repository,
    canonical_url
  )
  values (
    'github',
    p_owner,
    p_repository,
    p_canonical_url
  )
  on conflict (provider, owner, repository)
  do update set
    canonical_url = excluded.canonical_url,
    updated_at = now()
  returning id into v_project_id;

  insert into public.scans (
    project_id,
    requested_ref,
    limits
  )
  values (
    v_project_id,
    p_requested_ref,
    p_limits
  )
  returning id into v_scan_id;

  insert into public.scan_events (scan_id, event_type, status)
  values (v_scan_id, 'queued', 'queued');

  return query
  select v_project_id, v_scan_id, 'queued'::text;
end;
$$;

create or replace function public.claim_next_scan(
  p_worker_id text,
  p_lease_seconds integer,
  p_max_attempts integer
)
returns table (
  scan_id uuid,
  project_id uuid,
  requested_ref text,
  status text,
  attempt_count integer,
  limits jsonb,
  lease_expires_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_scan public.scans%rowtype;
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

  with exhausted as (
    select id
    from public.scans
    where status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
      and lease_expires_at <= v_now
      and attempt_count >= p_max_attempts
    for update skip locked
  ),
  failed as (
    update public.scans as scans
    set
      status = 'failed',
      worker_id = null,
      lease_expires_at = null,
      last_heartbeat_at = null,
      next_attempt_at = null,
      safe_error_code = 'attempts_exhausted',
      safe_error_message = 'Scan attempt limit was reached.',
      completed_at = v_now,
      updated_at = v_now
    from exhausted
    where scans.id = exhausted.id
    returning scans.id
  )
  insert into public.scan_events (
    scan_id,
    event_type,
    status,
    safe_error_code,
    safe_error_message
  )
  select
    id,
    'failed',
    'failed',
    'attempts_exhausted',
    'Scan attempt limit was reached.'
  from failed;

  select scans.*
  into v_scan
  from public.scans as scans
  where (
      (
        scans.status = 'queued'
        and coalesce(scans.next_attempt_at, scans.created_at) <= v_now
      )
      or (
        scans.status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
        and scans.lease_expires_at <= v_now
      )
    )
    and scans.attempt_count < p_max_attempts
  order by
    coalesce(scans.next_attempt_at, scans.created_at),
    scans.created_at
  for update skip locked
  limit 1;

  if v_scan.id is null then
    return;
  end if;

  update public.scans
  set
    status = 'validating',
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
  where id = v_scan.id
  returning * into v_scan;

  insert into public.scan_events (
    scan_id,
    event_type,
    status,
    worker_id,
    metadata
  )
  values (
    v_scan.id,
    'claimed',
    v_scan.status,
    p_worker_id,
    jsonb_build_object('attemptCount', v_scan.attempt_count)
  );

  return query
  select
    v_scan.id,
    v_scan.project_id,
    v_scan.requested_ref,
    v_scan.status,
    v_scan.attempt_count,
    v_scan.limits,
    v_scan.lease_expires_at;
end;
$$;

create or replace function public.heartbeat_scan(
  p_scan_id uuid,
  p_worker_id text,
  p_lease_seconds integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_updated boolean;
begin
  if p_lease_seconds < 15 or p_lease_seconds > 3600 then
    raise exception 'invalid lease duration';
  end if;

  update public.scans
  set
    lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
    last_heartbeat_at = v_now,
    updated_at = v_now
  where id = p_scan_id
    and worker_id = p_worker_id
    and status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
    and lease_expires_at > v_now;

  v_updated := found;

  if v_updated then
    insert into public.scan_events (scan_id, event_type, status, worker_id)
    select id, 'heartbeat', status, p_worker_id
    from public.scans
    where id = p_scan_id;
  end if;

  return v_updated;
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
security invoker
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.scans
  set
    status = 'queued',
    worker_id = null,
    lease_expires_at = null,
    last_heartbeat_at = null,
    next_attempt_at = greatest(p_next_attempt_at, now()),
    safe_error_code = p_safe_error_code,
    safe_error_message = p_safe_error_message,
    updated_at = now()
  where id = p_scan_id
    and worker_id = p_worker_id
    and status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting');

  v_updated := found;

  if v_updated then
    insert into public.scan_events (
      scan_id,
      event_type,
      status,
      worker_id,
      safe_error_code,
      safe_error_message,
      metadata
    )
    values (
      p_scan_id,
      'retry_scheduled',
      'queued',
      p_worker_id,
      p_safe_error_code,
      p_safe_error_message,
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
security invoker
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  update public.scans
  set
    status = 'failed',
    worker_id = null,
    lease_expires_at = null,
    last_heartbeat_at = null,
    next_attempt_at = null,
    safe_error_code = p_safe_error_code,
    safe_error_message = p_safe_error_message,
    completed_at = now(),
    updated_at = now()
  where id = p_scan_id
    and worker_id = p_worker_id
    and status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting');

  v_updated := found;

  if v_updated then
    insert into public.scan_events (
      scan_id,
      event_type,
      status,
      worker_id,
      safe_error_code,
      safe_error_message
    )
    values (
      p_scan_id,
      'failed',
      'failed',
      p_worker_id,
      p_safe_error_code,
      p_safe_error_message
    );
  end if;

  return v_updated;
end;
$$;

create or replace function public.complete_scan(
  p_scan_id uuid,
  p_worker_id text,
  p_status text,
  p_statistics jsonb,
  p_warnings jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated boolean;
begin
  if p_status not in ('completed', 'completed_with_warnings') then
    raise exception 'invalid completion status';
  end if;

  if jsonb_typeof(p_statistics) <> 'object' or jsonb_typeof(p_warnings) <> 'array' then
    raise exception 'invalid completion payload';
  end if;

  update public.scans
  set
    status = p_status,
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
  where id = p_scan_id
    and worker_id = p_worker_id
    and status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting');

  v_updated := found;

  if v_updated then
    insert into public.scan_events (scan_id, event_type, status, worker_id)
    values (p_scan_id, 'completed', p_status, p_worker_id);
  end if;

  return v_updated;
end;
$$;

revoke all on function public.claim_next_scan(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.heartbeat_scan(uuid, text, integer)
  from public, anon, authenticated;
revoke all on function public.release_scan_for_retry(uuid, text, timestamptz, text, text)
  from public, anon, authenticated;
revoke all on function public.fail_scan(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.complete_scan(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated;

grant execute on function public.claim_next_scan(text, integer, integer)
  to service_role;
grant execute on function public.heartbeat_scan(uuid, text, integer)
  to service_role;
grant execute on function public.release_scan_for_retry(uuid, text, timestamptz, text, text)
  to service_role;
grant execute on function public.fail_scan(uuid, text, text, text)
  to service_role;
grant execute on function public.complete_scan(uuid, text, text, jsonb, jsonb)
  to service_role;
