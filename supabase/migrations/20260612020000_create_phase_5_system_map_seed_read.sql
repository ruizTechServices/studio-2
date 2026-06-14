create or replace function public.get_scan_system_map_files(
  p_project_id uuid,
  p_scan_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select case
    when exists (
      select 1
      from public.scans as scan
      where scan.id = p_scan_id
        and scan.project_id = p_project_id
    )
    then coalesce((
      select jsonb_agg(jsonb_build_object(
        'relativePath', file.relative_path,
        'name', file.name,
        'extension', file.extension,
        'language', file.language,
        'category', file.category,
        'sizeBytes', file.size_bytes,
        'depth', file.depth,
        'isText', file.is_text
      ) order by file.relative_path)
      from public.scan_files as file
      where file.scan_id = p_scan_id
    ), '[]'::jsonb)
    else null
  end;
$$;

revoke all on function public.get_scan_system_map_files(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_scan_system_map_files(uuid, uuid)
  to service_role;
