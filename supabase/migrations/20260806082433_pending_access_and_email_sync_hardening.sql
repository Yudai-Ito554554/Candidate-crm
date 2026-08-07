-- Phase 4E: deny unapproved Auth users and make historical email imports reliable.

alter table public.profiles
drop constraint profiles_role_check;

alter table public.profiles
alter column role set default 'pending';

alter table public.profiles
add constraint profiles_role_check
check (role in ('pending', 'admin', 'agent', 'viewer'));

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
  if public.current_profile_role() is distinct from 'admin' then
    raise exception 'administrator role required' using errcode = '42501';
  end if;

  if new_role not in ('pending', 'admin', 'agent', 'viewer') then
    raise exception 'invalid profile role' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(20260806000900);

  if new_role <> 'admin'
     and (select role from public.profiles where id = target_user_id) = 'admin'
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

revoke all on function public.set_profile_role(uuid, text) from public, anon;
grant execute on function public.set_profile_role(uuid, text) to authenticated;

-- A pending user may read only their own profile so the desktop app can show
-- an approval-required screen. Approved workspace members retain shared reads.
drop policy if exists "authenticated users can read profiles" on public.profiles;
create policy "workspace members can read profiles"
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or public.current_profile_role() in ('admin', 'agent', 'viewer')
);

drop policy if exists "authenticated users can read candidates" on public.candidates;
create policy "workspace members can read candidates"
on public.candidates for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read candidate experiences" on public.candidate_experiences;
create policy "workspace members can read candidate experiences"
on public.candidate_experiences for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read companies" on public.companies;
create policy "workspace members can read companies"
on public.companies for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read company contacts" on public.company_contacts;
create policy "workspace members can read company contacts"
on public.company_contacts for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read jobs" on public.jobs;
create policy "workspace members can read jobs"
on public.jobs for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read applications" on public.applications;
create policy "workspace members can read applications"
on public.applications for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read activities" on public.activities;
create policy "workspace members can read activities"
on public.activities for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read tasks" on public.tasks;
create policy "workspace members can read tasks"
on public.tasks for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read files" on public.files;
create policy "workspace members can read files"
on public.files for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read email threads" on public.email_threads;
create policy "workspace members can read email threads"
on public.email_threads for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read email messages" on public.email_messages;
create policy "workspace members can read email messages"
on public.email_messages for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read tags" on public.tags;
create policy "workspace members can read tags"
on public.tags for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read candidate tags" on public.candidate_tags;
create policy "workspace members can read candidate tags"
on public.candidate_tags for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read company tags" on public.company_tags;
create policy "workspace members can read company tags"
on public.company_tags for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read job tags" on public.job_tags;
create policy "workspace members can read job tags"
on public.job_tags for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read application status history" on public.application_status_history;
create policy "workspace members can read application status history"
on public.application_status_history for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "users can read their own candidate views" on public.candidate_views;
create policy "workspace members can read their own candidate views"
on public.candidate_views for select to authenticated
using (
  (select auth.uid()) = user_id
  and public.current_profile_role() in ('admin', 'agent', 'viewer')
);

drop policy if exists "authenticated users can read ai summaries" on public.ai_summaries;
create policy "workspace members can read ai summaries"
on public.ai_summaries for select to authenticated
using (public.current_profile_role() in ('admin', 'agent', 'viewer'));

drop policy if exists "authenticated users can read crm files" on storage.objects;
create policy "workspace members can read crm files"
on storage.objects for select to authenticated
using (
  bucket_id = 'crm-files'
  and public.current_profile_role() in ('admin', 'agent', 'viewer')
);

create or replace function public.record_candidate_view(target_candidate_id uuid)
returns setof public.candidate_views
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  recorded_view public.candidate_views;
begin
  if current_user_id is null
     or public.current_profile_role() is null
     or public.current_profile_role() not in ('admin', 'agent', 'viewer') then
    raise exception using
      errcode = '42501',
      message = 'approved workspace membership required';
  end if;

  insert into public.candidate_views (user_id, candidate_id, viewed_at)
  values (current_user_id, target_candidate_id, now())
  on conflict (user_id, candidate_id)
  do update set viewed_at = excluded.viewed_at
  returning * into recorded_view;

  return next recorded_view;
  return;
end;
$$;

revoke all on function public.record_candidate_view(uuid) from public, anon;
grant execute on function public.record_candidate_view(uuid) to authenticated;

create or replace function public.refresh_email_thread_from_message()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.email_threads
  set
    last_sender_name = coalesce(new.sender_name, new.sender_email),
    last_message_preview = left(regexp_replace(new.body_text, '\\s+', ' ', 'g'), 160),
    last_message_at = new.sent_at
  where id = new.thread_id
    and (
      last_message_preview is null
      or new.sent_at >= last_message_at
    );
  return new;
end;
$$;

comment on column public.profiles.role is
  'pending denies CRM access until an administrator approves the user.';
