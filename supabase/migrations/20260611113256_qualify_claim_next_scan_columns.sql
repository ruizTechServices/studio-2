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
    select candidate.id
    from public.scans as candidate
    where candidate.status in ('fetching', 'validating', 'extracting', 'parsing', 'persisting')
      and candidate.lease_expires_at <= v_now
      and candidate.attempt_count >= p_max_attempts
    for update skip locked
  ),
  failed as (
    update public.scans as exhausted_scan
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
    from exhausted as exhausted_candidate
    where exhausted_scan.id = exhausted_candidate.id
    returning exhausted_scan.id
  )
  insert into public.scan_events (
    scan_id,
    event_type,
    status,
    safe_error_code,
    safe_error_message
  )
  select
    failed_scan.id,
    'failed',
    'failed',
    'attempts_exhausted',
    'Scan attempt limit was reached.'
  from failed as failed_scan;

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
  order by
    coalesce(candidate.next_attempt_at, candidate.created_at),
    candidate.created_at
  for update skip locked
  limit 1;

  if v_scan.id is null then
    return;
  end if;

  update public.scans as claimed_scan
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
  where claimed_scan.id = v_scan.id
  returning claimed_scan.* into v_scan;

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

revoke all on function public.claim_next_scan(text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.claim_next_scan(text, integer, integer)
  to service_role;
