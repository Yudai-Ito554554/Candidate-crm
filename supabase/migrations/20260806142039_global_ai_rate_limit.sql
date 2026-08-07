-- Apply one atomic per-user quota across candidate summaries and job imports.

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

drop index if exists public.ai_generation_requests_requested_by_idx;

create index ai_generation_requests_user_created_idx
  on public.ai_generation_requests (requested_by, created_at desc)
  where requested_by is not null;

create or replace function private.prepare_ai_usage_quota(
  requester_id uuid,
  request_time timestamptz
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  hourly_request_count bigint;
  daily_request_count bigint;
begin
  if requester_id is null then
    raise exception using errcode = '22004', message = 'ai_requester_required';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requester_id::text, 20260806141649)
  );

  update public.job_import_requests
  set
    status = 'failed',
    error_code = 'stale_request',
    completed_at = request_time
  where requested_by = requester_id
    and status = 'running'
    and started_at < request_time - interval '5 minutes';

  update public.ai_generation_requests
  set
    status = 'failed',
    error_code = 'stale_request',
    completed_at = request_time
  where requested_by = requester_id
    and status in ('pending', 'running')
    and created_at < request_time - interval '15 minutes';

  if exists (
    select 1
    from public.job_import_requests
    where requested_by = requester_id
      and status = 'running'
  ) or exists (
    select 1
    from public.ai_generation_requests
    where requested_by = requester_id
      and status in ('pending', 'running')
  ) then
    raise exception using errcode = 'P0001', message = 'ai_already_running';
  end if;

  select count(*)
  into hourly_request_count
  from (
    select created_at as requested_at
    from public.ai_generation_requests
    where requested_by = requester_id
    union all
    select started_at as requested_at
    from public.job_import_requests
    where requested_by = requester_id
  ) as usage_events
  where requested_at >= request_time - interval '1 hour';

  if hourly_request_count >= 20 then
    raise exception using errcode = 'P0001', message = 'ai_hourly_limit';
  end if;

  select count(*)
  into daily_request_count
  from (
    select created_at as requested_at
    from public.ai_generation_requests
    where requested_by = requester_id
    union all
    select started_at as requested_at
    from public.job_import_requests
    where requested_by = requester_id
  ) as usage_events
  where requested_at >= request_time - interval '1 day';

  if daily_request_count >= 50 then
    raise exception using errcode = 'P0001', message = 'ai_daily_limit';
  end if;
end;
$$;

revoke all on function private.prepare_ai_usage_quota(uuid, timestamptz) from public;
revoke all on function private.prepare_ai_usage_quota(uuid, timestamptz) from anon;
revoke all on function private.prepare_ai_usage_quota(uuid, timestamptz) from authenticated;

create or replace function public.claim_job_import_request(
  requester_id uuid,
  request_source_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_request_id uuid;
  request_time timestamptz := statement_timestamp();
begin
  if request_source_type is null
    or request_source_type not in ('text', 'pdf', 'url') then
    raise exception using errcode = '22023', message = 'job_import_invalid_source_type';
  end if;

  perform private.prepare_ai_usage_quota(requester_id, request_time);

  insert into public.job_import_requests (
    requested_by,
    source_type,
    status,
    started_at
  ) values (
    requester_id,
    request_source_type,
    'running',
    request_time
  )
  returning id into claimed_request_id;

  return claimed_request_id;
end;
$$;

revoke all on function public.claim_job_import_request(uuid, text) from public;
revoke all on function public.claim_job_import_request(uuid, text) from anon;
revoke all on function public.claim_job_import_request(uuid, text) from authenticated;
grant execute on function public.claim_job_import_request(uuid, text) to service_role;

create or replace function public.claim_candidate_ai_request(
  requester_id uuid,
  target_candidate_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_request_id uuid;
  request_time timestamptz := statement_timestamp();
begin
  if target_candidate_id is null then
    raise exception using errcode = '22004', message = 'ai_candidate_required';
  end if;

  perform private.prepare_ai_usage_quota(requester_id, request_time);

  update public.ai_generation_requests
  set
    status = 'failed',
    error_code = 'stale_request',
    completed_at = request_time
  where candidate_id = target_candidate_id
    and status in ('pending', 'running')
    and created_at < request_time - interval '15 minutes';

  if exists (
    select 1
    from public.ai_generation_requests
    where candidate_id = target_candidate_id
      and status in ('pending', 'running')
  ) then
    raise exception using errcode = 'P0001', message = 'ai_candidate_already_running';
  end if;

  if exists (
    select 1
    from public.ai_generation_requests
    where candidate_id = target_candidate_id
      and created_at >= request_time - interval '5 minutes'
  ) then
    raise exception using errcode = 'P0001', message = 'ai_candidate_cooldown';
  end if;

  insert into public.ai_generation_requests (
    candidate_id,
    requested_by,
    status,
    started_at,
    created_at
  ) values (
    target_candidate_id,
    requester_id,
    'running',
    request_time,
    request_time
  )
  returning id into claimed_request_id;

  return claimed_request_id;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'ai_candidate_already_running';
end;
$$;

revoke all on function public.claim_candidate_ai_request(uuid, uuid) from public;
revoke all on function public.claim_candidate_ai_request(uuid, uuid) from anon;
revoke all on function public.claim_candidate_ai_request(uuid, uuid) from authenticated;
grant execute on function public.claim_candidate_ai_request(uuid, uuid) to service_role;

comment on function public.claim_candidate_ai_request(uuid, uuid) is
  'Claims a candidate summary slot under the shared per-user AI quota and candidate cooldown.';

comment on function public.claim_job_import_request(uuid, text) is
  'Claims a job import slot under the shared per-user AI quota.';
