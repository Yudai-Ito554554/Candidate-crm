-- Batch 4: distinguish user, verified service, and system audit actors.

alter table public.audit_logs
  add column actor_kind text not null default 'user'
  check (actor_kind in ('user', 'service', 'system'));

-- Historical rows with a null actor cannot be attributed reliably after the
-- fact. This backfill is intentionally irreversible: classify them as system
-- operations rather than inventing a human requester.
update public.audit_logs
set actor_kind = 'system'
where actor_id is null;

comment on column public.audit_logs.actor_kind is
  'Audit origin: user (authenticated session), service (verified requester propagated by a service-only RPC), or system (no human requester).';

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
  audit_actor_id uuid;
  audit_actor_kind text;
  authenticated_actor_id uuid;
  service_actor_text text;
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

  authenticated_actor_id := (select auth.uid());
  service_actor_text := nullif(
    current_setting('app.audit_actor_id', true),
    ''
  );

  if authenticated_actor_id is not null then
    audit_actor_id := authenticated_actor_id;
    audit_actor_kind := 'user';
  elsif service_actor_text is not null then
    audit_actor_id := service_actor_text::uuid;
    audit_actor_kind := 'service';
  else
    audit_actor_id := null;
    audit_actor_kind := 'system';
  end if;

  insert into public.audit_logs (
    actor_id,
    actor_kind,
    action,
    entity_type,
    entity_id,
    changed_fields
  ) values (
    audit_actor_id,
    audit_actor_kind,
    audit_action,
    tg_argv[0],
    audit_entity_id,
    audit_changed_fields
  );

  return new;
end;
$$;

create or replace function public.store_candidate_ai_summary(
  target_candidate_id uuid,
  requester_id uuid,
  provider_model text,
  provider_prompt_version text,
  summary_candidate text,
  summary_change_reason text,
  summary_strengths text,
  summary_concerns text,
  summary_interview_questions text,
  summary_recommended_jobs text,
  summary_next_action text,
  summary_email_draft text,
  activity_through_at timestamptz
)
returns public.ai_summaries
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  stored_summary public.ai_summaries;
begin
  perform set_config('app.audit_actor_id', requester_id::text, true);

  insert into public.ai_summaries (
    candidate_id,
    generated_by,
    model,
    prompt_version,
    candidate_summary,
    change_reason_summary,
    strengths,
    concerns,
    interview_questions,
    recommended_jobs,
    next_action,
    email_draft,
    source_activity_through_at,
    generated_at
  ) values (
    target_candidate_id,
    requester_id,
    provider_model,
    provider_prompt_version,
    summary_candidate,
    summary_change_reason,
    summary_strengths,
    summary_concerns,
    summary_interview_questions,
    summary_recommended_jobs,
    summary_next_action,
    summary_email_draft,
    activity_through_at,
    now()
  )
  returning * into stored_summary;

  update public.ai_summaries
  set archived_at = now()
  where candidate_id = target_candidate_id
    and id <> stored_summary.id
    and archived_at is null;

  return stored_summary;
end;
$$;

create or replace function public.apply_invited_profile_role(
  target_user_id uuid,
  new_role text,
  requester_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.audit_actor_id', requester_id::text, true);

  if new_role is null or new_role not in ('agent', 'viewer') then
    raise exception using
      errcode = '22023',
      message = 'invite role must be agent or viewer';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id;

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'invited profile not found';
  end if;
end;
$$;

revoke all on function public.apply_invited_profile_role(uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.apply_invited_profile_role(uuid, text, uuid)
to service_role;

comment on function public.apply_invited_profile_role(uuid, text, uuid) is
  'Service-only invited-user role assignment with verified requester attribution.';
