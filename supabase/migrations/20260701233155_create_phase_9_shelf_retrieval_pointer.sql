-- Phase 9: retrieval-on-demand pointer read.
-- Returns only the provenance fields required to fetch a shelf asset's source
-- file at its pinned commit. Source contents are never stored; retrieval
-- happens in bounded route-handler memory and is discarded after the response.

create or replace function public.get_shelf_asset_retrieval_pointer(
  p_asset_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'id', asset.id,
    'sourceOwner', asset.source_owner,
    'sourceRepository', asset.source_repository,
    'sourceCommitSha', asset.source_commit_sha,
    'relativePath', asset.relative_path,
    'lineStart', asset.line_start,
    'lineEnd', asset.line_end,
    'symbolName', asset.symbol_name
  )
  from public.shelf_assets as asset
  where asset.id = p_asset_id
$$;

revoke all on function public.get_shelf_asset_retrieval_pointer(uuid)
  from public, anon, authenticated;
grant execute on function public.get_shelf_asset_retrieval_pointer(uuid) to service_role;
