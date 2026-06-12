create or replace function public.get_scan_results(
  p_project_id uuid,
  p_scan_id uuid,
  p_preview_limit integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_preview_limit < 0 or p_preview_limit > 50 then
    raise exception 'invalid preview limit';
  end if;

  select jsonb_build_object(
    'project', jsonb_build_object(
      'id', project.id,
      'owner', project.owner,
      'repository', project.repository,
      'canonicalUrl', project.canonical_url,
      'defaultBranch', project.default_branch
    ),
    'scan', jsonb_build_object(
      'id', scan.id,
      'projectId', scan.project_id,
      'requestedRef', scan.requested_ref,
      'resolvedRef', scan.resolved_ref,
      'sourceCommitSha', scan.source_commit_sha,
      'status', scan.status,
      'statistics', scan.statistics,
      'warnings', scan.warnings,
      'safeError', scan.safe_error_message,
      'createdAt', scan.created_at,
      'startedAt', scan.started_at,
      'completedAt', scan.completed_at,
      'updatedAt', scan.updated_at
    ),
    'inventoryPreview', coalesce((
      select jsonb_agg(jsonb_build_object(
        'relativePath', preview.relative_path,
        'language', preview.language,
        'category', preview.category,
        'sizeBytes', preview.size_bytes,
        'isText', preview.is_text
      ) order by preview.relative_path)
      from (
        select file.relative_path, file.language, file.category,
          file.size_bytes, file.is_text
        from public.scan_files as file
        where file.scan_id = scan.id
        order by file.relative_path
        limit p_preview_limit
      ) as preview
    ), '[]'::jsonb)
  )
  into v_result
  from public.scans as scan
  join public.projects as project on project.id = scan.project_id
  where scan.id = p_scan_id
    and project.id = p_project_id;

  return v_result;
end;
$$;

revoke all on function public.get_scan_results(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.get_scan_results(uuid, uuid, integer)
  to service_role;
