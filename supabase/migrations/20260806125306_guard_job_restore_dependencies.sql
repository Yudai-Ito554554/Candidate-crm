create function public.validate_job_restore_dependencies()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.archived_at is null or new.archived_at is not null then
    return new;
  end if;

  if not exists (
    select 1
    from public.companies
    where id = new.company_id
      and archived_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'cannot restore job while its company is archived';
  end if;

  if new.contact_id is not null and not exists (
    select 1
    from public.company_contacts
    where id = new.contact_id
      and company_id = new.company_id
      and archived_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'cannot restore job while its contact is archived';
  end if;

  return new;
end;
$$;

create trigger jobs_validate_restore_dependencies
before update of archived_at on public.jobs
for each row execute function public.validate_job_restore_dependencies();

revoke all on function public.validate_job_restore_dependencies()
from public, anon, authenticated;
