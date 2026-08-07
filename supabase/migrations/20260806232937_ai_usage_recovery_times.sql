-- Add rolling-window recovery timestamps to the service-only AI usage aggregate.

drop function public.get_ai_usage_snapshot();

create function public.get_ai_usage_snapshot()
returns table (
  requested_by uuid,
  feature text,
  last_hour_count bigint,
  last_day_count bigint,
  completed_count bigint,
  failed_count bigint,
  running_count bigint,
  next_hourly_recovery_at timestamptz,
  next_daily_recovery_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with request_time as (
    select statement_timestamp() as value
  ),
  usage_events as (
    select
      requests.requested_by,
      'candidate_summary'::text as feature,
      case
        when requests.status in ('pending', 'running')
          and requests.created_at < request_time.value - interval '15 minutes'
          then 'failed'
        when requests.status in ('pending', 'running') then 'running'
        else requests.status
      end as effective_status,
      requests.created_at as requested_at
    from public.ai_generation_requests as requests
    cross join request_time
    where requests.requested_by is not null
      and requests.created_at >= request_time.value - interval '1 day'

    union all

    select
      requests.requested_by,
      'job_import'::text as feature,
      case
        when requests.status = 'running'
          and requests.started_at < request_time.value - interval '5 minutes'
          then 'failed'
        else requests.status
      end as effective_status,
      requests.started_at as requested_at
    from public.job_import_requests as requests
    cross join request_time
    where requests.started_at >= request_time.value - interval '1 day'
  )
  select
    usage_events.requested_by,
    usage_events.feature,
    count(*) filter (
      where usage_events.requested_at >= request_time.value - interval '1 hour'
    ) as last_hour_count,
    count(*) as last_day_count,
    count(*) filter (
      where usage_events.effective_status = 'completed'
    ) as completed_count,
    count(*) filter (
      where usage_events.effective_status = 'failed'
    ) as failed_count,
    count(*) filter (
      where usage_events.effective_status = 'running'
    ) as running_count,
    min(usage_events.requested_at) filter (
      where usage_events.requested_at >= request_time.value - interval '1 hour'
    ) + interval '1 hour' as next_hourly_recovery_at,
    min(usage_events.requested_at) + interval '1 day'
      as next_daily_recovery_at
  from usage_events
  cross join request_time
  group by usage_events.requested_by, usage_events.feature
  order by usage_events.requested_by, usage_events.feature;
$$;

revoke all on function public.get_ai_usage_snapshot() from public;
revoke all on function public.get_ai_usage_snapshot() from anon;
revoke all on function public.get_ai_usage_snapshot() from authenticated;
grant execute on function public.get_ai_usage_snapshot() to service_role;

comment on function public.get_ai_usage_snapshot() is
  'Returns AI usage counts and rolling-window recovery timestamps to the authenticated Edge Function. It never returns prompts, source content, candidate IDs, or provider output.';
