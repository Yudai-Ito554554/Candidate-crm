-- Archive a shared tag only when no active entity still uses it.

create or replace function public.archive_unused_tag(target_tag_id uuid)
returns public.tags
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  archived_tag public.tags;
begin
  if public.current_profile_role() not in ('admin', 'agent') then
    raise exception 'editor role required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.candidate_tags
    where tag_id = target_tag_id and archived_at is null
    union all
    select 1 from public.company_tags
    where tag_id = target_tag_id and archived_at is null
    union all
    select 1 from public.job_tags
    where tag_id = target_tag_id and archived_at is null
  ) then
    raise exception 'tag is still in use' using errcode = '23503';
  end if;

  update public.tags
  set archived_at = now()
  where id = target_tag_id
    and archived_at is null
  returning * into archived_tag;

  if archived_tag.id is null then
    raise exception 'active tag not found' using errcode = 'P0002';
  end if;

  return archived_tag;
end;
$$;

revoke all on function public.archive_unused_tag(uuid) from public, anon;
grant execute on function public.archive_unused_tag(uuid) to authenticated;

comment on function public.archive_unused_tag(uuid) is
  'Archives an unused shared tag atomically; active candidate, company, or job relations block the operation.';
