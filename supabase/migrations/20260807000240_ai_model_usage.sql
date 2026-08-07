-- Attribute token usage to the provider-reported model without storing AI content.

alter table public.ai_generation_requests
  add column provider_model text,
  add constraint ai_generation_requests_provider_model_length
    check (
      provider_model is null
      or (provider_model = btrim(provider_model) and char_length(provider_model) between 1 and 100)
    );

alter table public.job_import_requests
  add column provider_model text,
  add constraint job_import_requests_provider_model_length
    check (
      provider_model is null
      or (provider_model = btrim(provider_model) and char_length(provider_model) between 1 and 100)
    );

comment on column public.ai_generation_requests.provider_model is
  'Provider-reported model identifier used for this request. No prompt or generated content is stored.';
comment on column public.job_import_requests.provider_model is
  'Provider-reported model identifier used for this request. No source or generated content is stored.';

drop function public.get_ai_usage_snapshot();

create function public.get_ai_usage_snapshot()
returns table (
  requested_by uuid,
  feature text,
  provider_model text,
  last_hour_count bigint,
  last_day_count bigint,
  completed_count bigint,
  failed_count bigint,
  running_count bigint,
  input_token_count bigint,
  output_token_count bigint,
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
      requests.provider_model,
      case
        when requests.status in ('pending', 'running')
          and requests.created_at < request_time.value - interval '15 minutes'
          then 'failed'
        when requests.status in ('pending', 'running') then 'running'
        else requests.status
      end as effective_status,
      requests.created_at as requested_at,
      requests.input_tokens,
      requests.output_tokens
    from public.ai_generation_requests as requests
    cross join request_time
    where requests.requested_by is not null
      and requests.created_at >= request_time.value - interval '1 day'

    union all

    select
      requests.requested_by,
      'job_import'::text as feature,
      requests.provider_model,
      case
        when requests.status = 'running'
          and requests.started_at < request_time.value - interval '5 minutes'
          then 'failed'
        else requests.status
      end as effective_status,
      requests.started_at as requested_at,
      requests.input_tokens,
      requests.output_tokens
    from public.job_import_requests as requests
    cross join request_time
    where requests.started_at >= request_time.value - interval '1 day'
  )
  select
    usage_events.requested_by,
    usage_events.feature,
    usage_events.provider_model,
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
    coalesce(sum(usage_events.input_tokens), 0)::bigint as input_token_count,
    coalesce(sum(usage_events.output_tokens), 0)::bigint as output_token_count,
    min(usage_events.requested_at) filter (
      where usage_events.requested_at >= request_time.value - interval '1 hour'
    ) + interval '1 hour' as next_hourly_recovery_at,
    min(usage_events.requested_at) + interval '1 day'
      as next_daily_recovery_at
  from usage_events
  cross join request_time
  group by
    usage_events.requested_by,
    usage_events.feature,
    usage_events.provider_model
  order by
    usage_events.requested_by,
    usage_events.feature,
    usage_events.provider_model nulls first;
$$;

revoke all on function public.get_ai_usage_snapshot() from public;
revoke all on function public.get_ai_usage_snapshot() from anon;
revoke all on function public.get_ai_usage_snapshot() from authenticated;
grant execute on function public.get_ai_usage_snapshot() to service_role;

comment on function public.get_ai_usage_snapshot() is
  'Returns AI request counts, provider model identifiers, token totals, and rolling-window recovery timestamps to the authenticated Edge Function. It never returns prompts, source content, candidate IDs, or provider output.';
