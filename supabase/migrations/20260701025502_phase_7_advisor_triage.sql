create policy deny_client_access_to_logs
  on public.logs
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy deny_client_access_to_projects
  on public.projects
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy deny_client_access_to_scan_events
  on public.scan_events
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy deny_client_access_to_scan_files
  on public.scan_files
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy deny_client_access_to_scan_reusable_asset_candidates
  on public.scan_reusable_asset_candidates
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy deny_client_access_to_scan_symbols
  on public.scan_symbols
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy deny_client_access_to_scans
  on public.scans
  for all
  to anon, authenticated
  using (false)
  with check (false);

revoke all on table public.logs from public, anon, authenticated;
revoke all on table public.projects from public, anon, authenticated;
revoke all on table public.scan_events from public, anon, authenticated;
revoke all on table public.scan_files from public, anon, authenticated;
revoke all on table public.scan_reusable_asset_candidates from public, anon, authenticated;
revoke all on table public.scan_symbols from public, anon, authenticated;
revoke all on table public.scans from public, anon, authenticated;

create index if not exists scan_reusable_asset_candidates_project_id_idx
  on public.scan_reusable_asset_candidates (project_id);
