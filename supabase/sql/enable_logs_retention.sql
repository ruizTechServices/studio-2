-- Run manually only after enabling Supabase Cron / pg_cron for the project.
select cron.schedule(
  'delete-logs-older-than-30-days',
  '0 3 * * *',
  $$delete from public.logs where created_at < now() - interval '30 days';$$
);
