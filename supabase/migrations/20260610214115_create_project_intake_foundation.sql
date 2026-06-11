create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'github',
  owner text not null,
  repository text not null,
  canonical_url text not null,
  default_branch text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_provider_check check (provider = 'github'),
  constraint projects_identity_unique unique (provider, owner, repository)
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  requested_ref text,
  resolved_ref text,
  source_commit_sha text,
  scanner_version text not null default 'phase-1-intake-skeleton',
  status text not null default 'queued',
  attempt_count integer not null default 0,
  worker_id text,
  lease_expires_at timestamptz,
  limits jsonb not null,
  statistics jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  safe_error_code text,
  safe_error_message text,
  summary_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint scans_status_check check (
    status in (
      'queued',
      'fetching',
      'validating',
      'extracting',
      'parsing',
      'persisting',
      'completed',
      'completed_with_warnings',
      'failed'
    )
  ),
  constraint scans_summary_status_check check (
    summary_status in ('not_started', 'pending', 'completed', 'failed')
  ),
  constraint scans_attempt_count_check check (attempt_count >= 0),
  constraint scans_limits_object_check check (jsonb_typeof(limits) = 'object'),
  constraint scans_statistics_object_check
    check (jsonb_typeof(statistics) = 'object'),
  constraint scans_warnings_array_check check (jsonb_typeof(warnings) = 'array')
);

create index if not exists scans_project_created_at_idx
  on public.scans (project_id, created_at desc);
create index if not exists scans_status_created_at_idx
  on public.scans (status, created_at);

alter table public.projects enable row level security;
alter table public.scans enable row level security;

revoke all on table public.projects from public, anon, authenticated;
revoke all on table public.scans from public, anon, authenticated;

grant select, insert, update on table public.projects to service_role;
grant select, insert on table public.scans to service_role;

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

  return query
  select v_project_id, v_scan_id, 'queued'::text;
end;
$$;

revoke all on function public.create_project_scan(text, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_project_scan(text, text, text, text, jsonb)
  to service_role;
