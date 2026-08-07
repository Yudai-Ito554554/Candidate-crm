-- Server-only audit metadata and atomic quotas for AI-assisted job imports.
-- Source text, URLs, filenames, and extracted results are intentionally absent.

create table public.job_import_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('text', 'pdf', 'url')),
  status text not null default 'running' check (
    status in ('running', 'completed', 'failed')
  ),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint job_import_requests_completion_check check (
    (status = 'running' and completed_at is null)
    or (status in ('completed', 'failed') and completed_at is not null)
  ),
  constraint job_import_requests_error_check check (
    (status = 'failed' and error_code is not null)
    or (status <> 'failed' and error_code is null)
  )
);

create unique index job_import_requests_active_user_idx
  on public.job_import_requests (requested_by)
  where status = 'running';

create index job_import_requests_user_started_idx
  on public.job_import_requests (requested_by, started_at desc);

alter table public.job_import_requests enable row level security;

revoke all on table public.job_import_requests from public;
revoke all on table public.job_import_requests from anon;
revoke all on table public.job_import_requests from authenticated;
grant select, insert, update on table public.job_import_requests to service_role;

comment on table public.job_import_requests is
  'Server-only AI job-import usage metadata. Never stores source text, URLs, filenames, or extraction results.';

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
  if requester_id is null then
    raise exception using errcode = '22004', message = 'job_import_requester_required';
  end if;

  if request_source_type is null
    or request_source_type not in ('text', 'pdf', 'url') then
    raise exception using errcode = '22023', message = 'job_import_invalid_source_type';
  end if;

  -- One short transaction-scoped lock serializes quota checks for this user.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requester_id::text, 20260806140542)
  );

  -- A terminated Edge invocation must not block the user indefinitely.
  update public.job_import_requests
  set
    status = 'failed',
    error_code = 'stale_request',
    completed_at = request_time
  where requested_by = requester_id
    and status = 'running'
    and started_at < request_time - interval '5 minutes';

  if exists (
    select 1
    from public.job_import_requests
    where requested_by = requester_id
      and status = 'running'
  ) then
    raise exception using errcode = 'P0001', message = 'job_import_already_running';
  end if;

  if (
    select count(*)
    from public.job_import_requests
    where requested_by = requester_id
      and started_at >= request_time - interval '1 hour'
  ) >= 20 then
    raise exception using errcode = 'P0001', message = 'job_import_hourly_limit';
  end if;

  if (
    select count(*)
    from public.job_import_requests
    where requested_by = requester_id
      and started_at >= request_time - interval '1 day'
  ) >= 50 then
    raise exception using errcode = 'P0001', message = 'job_import_daily_limit';
  end if;

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

comment on function public.claim_job_import_request(uuid, text) is
  'Atomically enforces one active import, 20 imports per hour, and 50 imports per rolling day for one user.';
