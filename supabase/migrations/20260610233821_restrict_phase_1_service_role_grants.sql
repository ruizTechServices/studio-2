revoke all on table public.logs from service_role;
revoke all on table public.projects from service_role;
revoke all on table public.scans from service_role;

grant insert on table public.logs to service_role;
grant select, insert, update on table public.projects to service_role;
grant select, insert on table public.scans to service_role;
