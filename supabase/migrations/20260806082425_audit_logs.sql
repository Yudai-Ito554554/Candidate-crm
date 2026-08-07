-- Phase 3W: immutable, metadata-only audit logs for important CRM writes.

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null check (
    action in (
      'create',
      'update',
      'archive',
      'restore',
      'complete',
      'reopen',
      'review',
      'role_change'
    )
  ),
  entity_type text not null check (
    entity_type in (
      'profile',
      'candidate',
      'candidate_experience',
      'company',
      'company_contact',
      'job',
      'application',
      'activity',
      'task',
      'file',
      'email_thread',
      'tag',
      'candidate_tag',
      'company_tag',
      'job_tag',
      'ai_summary'
    )
  ),
  entity_id uuid not null,
  changed_fields text[] not null default '{}',
  transaction_id bigint not null default txid_current(),
  occurred_at timestamptz not null default now()
);

create index audit_logs_occurred_idx
on public.audit_logs (occurred_at desc, id desc);

create index audit_logs_actor_occurred_idx
on public.audit_logs (actor_id, occurred_at desc);

create index audit_logs_entity_occurred_idx
on public.audit_logs (entity_type, entity_id, occurred_at desc);

alter table public.audit_logs enable row level security;

create policy "administrators can read audit logs"
on public.audit_logs for select to authenticated
using (public.current_profile_role() = 'admin');

revoke all on table public.audit_logs from anon;
revoke all on table public.audit_logs from authenticated;
grant select on table public.audit_logs to authenticated;

create or replace function public.record_crm_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  audit_action text;
  audit_entity_id uuid;
  audit_changed_fields text[] := '{}';
begin
  audit_entity_id := (to_jsonb(new) ->> 'id')::uuid;

  if tg_op = 'INSERT' then
    audit_action := 'create';
  elsif tg_op = 'UPDATE' then
    select coalesce(array_agg(field_name order by field_name), '{}')
    into audit_changed_fields
    from (
      select new_field.key as field_name
      from jsonb_each(to_jsonb(new)) as new_field
      join jsonb_each(to_jsonb(old)) as old_field
        on old_field.key = new_field.key
      where new_field.value is distinct from old_field.value
        and new_field.key not in ('created_at', 'updated_at')
    ) as changed;

    audit_action := case
      when 'archived_at' = any(audit_changed_fields)
        and (to_jsonb(new) ->> 'archived_at') is not null
        then 'archive'
      when 'archived_at' = any(audit_changed_fields)
        and (to_jsonb(new) ->> 'archived_at') is null
        then 'restore'
      when tg_table_name = 'tasks'
        and 'completed_at' = any(audit_changed_fields)
        and (to_jsonb(new) ->> 'completed_at') is not null
        then 'complete'
      when tg_table_name = 'tasks'
        and 'completed_at' = any(audit_changed_fields)
        and (to_jsonb(new) ->> 'completed_at') is null
        then 'reopen'
      when tg_table_name = 'ai_summaries'
        and 'reviewed_at' = any(audit_changed_fields)
        then 'review'
      when tg_table_name = 'profiles'
        and 'role' = any(audit_changed_fields)
        then 'role_change'
      else 'update'
    end;
  else
    return new;
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    changed_fields
  ) values (
    (select auth.uid()),
    audit_action,
    tg_argv[0],
    audit_entity_id,
    audit_changed_fields
  );

  return new;
end;
$$;

revoke all on function public.record_crm_audit_log() from public;
revoke all on function public.record_crm_audit_log() from anon;
revoke all on function public.record_crm_audit_log() from authenticated;

create trigger audit_profiles
after insert or update on public.profiles
for each row execute function public.record_crm_audit_log('profile');

create trigger audit_candidates
after insert or update on public.candidates
for each row execute function public.record_crm_audit_log('candidate');

create trigger audit_candidate_experiences
after insert or update on public.candidate_experiences
for each row execute function public.record_crm_audit_log('candidate_experience');

create trigger audit_companies
after insert or update on public.companies
for each row execute function public.record_crm_audit_log('company');

create trigger audit_company_contacts
after insert or update on public.company_contacts
for each row execute function public.record_crm_audit_log('company_contact');

create trigger audit_jobs
after insert or update on public.jobs
for each row execute function public.record_crm_audit_log('job');

create trigger audit_applications
after insert or update on public.applications
for each row execute function public.record_crm_audit_log('application');

create trigger audit_activities
after insert or update on public.activities
for each row execute function public.record_crm_audit_log('activity');

create trigger audit_tasks
after insert or update on public.tasks
for each row execute function public.record_crm_audit_log('task');

create trigger audit_files
after insert or update on public.files
for each row execute function public.record_crm_audit_log('file');

create trigger audit_email_threads
after insert or update on public.email_threads
for each row execute function public.record_crm_audit_log('email_thread');

create trigger audit_tags
after insert or update on public.tags
for each row execute function public.record_crm_audit_log('tag');

create trigger audit_candidate_tags
after insert or update on public.candidate_tags
for each row execute function public.record_crm_audit_log('candidate_tag');

create trigger audit_company_tags
after insert or update on public.company_tags
for each row execute function public.record_crm_audit_log('company_tag');

create trigger audit_job_tags
after insert or update on public.job_tags
for each row execute function public.record_crm_audit_log('job_tag');

create trigger audit_ai_summaries
after insert or update on public.ai_summaries
for each row execute function public.record_crm_audit_log('ai_summary');

comment on table public.audit_logs is
  'Immutable metadata-only audit trail. Field values and business text are deliberately not copied.';
