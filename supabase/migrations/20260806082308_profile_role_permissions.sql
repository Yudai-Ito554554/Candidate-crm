-- Phase 3S: enforce admin/agent/viewer permissions in the database.

create or replace function public.current_profile_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.current_profile_role() from public;
grant execute on function public.current_profile_role() to authenticated;

create or replace function public.set_profile_role(
  target_user_id uuid,
  new_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_profile public.profiles;
begin
  if public.current_profile_role() <> 'admin' then
    raise exception 'administrator role required' using errcode = '42501';
  end if;

  if new_role not in ('admin', 'agent', 'viewer') then
    raise exception 'invalid profile role' using errcode = '22023';
  end if;

  if target_user_id = (select auth.uid())
     and new_role <> 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'the final administrator cannot be demoted'
      using errcode = '23514';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.set_profile_role(uuid, text) from public;
grant execute on function public.set_profile_role(uuid, text) to authenticated;

drop policy if exists "authenticated users can insert candidates" on public.candidates;
drop policy if exists "authenticated users can update candidates" on public.candidates;
create policy "editors can insert candidates"
on public.candidates for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update candidates"
on public.candidates for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert candidate experiences" on public.candidate_experiences;
drop policy if exists "authenticated users can update candidate experiences" on public.candidate_experiences;
create policy "editors can insert candidate experiences"
on public.candidate_experiences for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update candidate experiences"
on public.candidate_experiences for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert companies" on public.companies;
drop policy if exists "authenticated users can update companies" on public.companies;
create policy "editors can insert companies"
on public.companies for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update companies"
on public.companies for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert company contacts" on public.company_contacts;
drop policy if exists "authenticated users can update company contacts" on public.company_contacts;
create policy "editors can insert company contacts"
on public.company_contacts for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update company contacts"
on public.company_contacts for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert jobs" on public.jobs;
drop policy if exists "authenticated users can update jobs" on public.jobs;
create policy "editors can insert jobs"
on public.jobs for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update jobs"
on public.jobs for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert applications" on public.applications;
drop policy if exists "authenticated users can update applications" on public.applications;
create policy "editors can insert applications"
on public.applications for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update applications"
on public.applications for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert activities" on public.activities;
drop policy if exists "authenticated users can update activities" on public.activities;
create policy "editors can insert activities"
on public.activities for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update activities"
on public.activities for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert tasks" on public.tasks;
drop policy if exists "authenticated users can update tasks" on public.tasks;
create policy "editors can insert tasks"
on public.tasks for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update tasks"
on public.tasks for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert files" on public.files;
drop policy if exists "authenticated users can update files" on public.files;
create policy "editors can insert files"
on public.files for insert to authenticated
with check (
  public.current_profile_role() in ('admin', 'agent')
  and (select auth.uid()) = owner_id
);
create policy "editors can update files"
on public.files for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can update email thread workflow" on public.email_threads;
create policy "editors can update email thread workflow"
on public.email_threads for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert tags" on public.tags;
drop policy if exists "authenticated users can update tags" on public.tags;
create policy "editors can insert tags"
on public.tags for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update tags"
on public.tags for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert candidate tags" on public.candidate_tags;
drop policy if exists "authenticated users can update candidate tags" on public.candidate_tags;
create policy "editors can insert candidate tags"
on public.candidate_tags for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update candidate tags"
on public.candidate_tags for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert company tags" on public.company_tags;
drop policy if exists "authenticated users can update company tags" on public.company_tags;
create policy "editors can insert company tags"
on public.company_tags for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update company tags"
on public.company_tags for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can insert job tags" on public.job_tags;
drop policy if exists "authenticated users can update job tags" on public.job_tags;
create policy "editors can insert job tags"
on public.job_tags for insert to authenticated
with check (public.current_profile_role() in ('admin', 'agent'));
create policy "editors can update job tags"
on public.job_tags for update to authenticated
using (public.current_profile_role() in ('admin', 'agent'))
with check (public.current_profile_role() in ('admin', 'agent'));

drop policy if exists "authenticated users can upload crm files" on storage.objects;
create policy "editors can upload crm files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'crm-files'
  and public.current_profile_role() in ('admin', 'agent')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "users can clean up their failed crm uploads" on storage.objects;
create policy "editors can clean up their failed crm uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'crm-files'
  and public.current_profile_role() in ('admin', 'agent')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
