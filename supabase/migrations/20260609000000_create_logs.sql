create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  source text not null,
  route text,
  user_id uuid,
  correlation_id uuid not null,
  created_at timestamptz not null default now(),
  constraint logs_level_check
    check (level in ('debug', 'info', 'warn', 'error', 'fatal', 'audit')),
  constraint logs_source_check
    check (source in ('server', 'client'))
);

create index if not exists logs_created_at_idx on public.logs (created_at);
create index if not exists logs_correlation_id_idx
  on public.logs (correlation_id);

alter table public.logs enable row level security;

revoke all on table public.logs from public, anon, authenticated;
grant insert on table public.logs to service_role;
