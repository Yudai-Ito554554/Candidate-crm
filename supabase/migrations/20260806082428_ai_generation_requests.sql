-- Phase 3X: server-only AI generation request state and concurrency guard.

create table public.ai_generation_requests (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id),
  requested_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_generation_requests_completion_check check (
    (status in ('pending', 'running') and completed_at is null)
    or (status in ('completed', 'failed') and completed_at is not null)
  ),
  constraint ai_generation_requests_error_check check (
    (status = 'failed' and error_code is not null)
    or (status <> 'failed' and error_code is null)
  )
);

create unique index ai_generation_requests_active_candidate_idx
on public.ai_generation_requests (candidate_id)
where status in ('pending', 'running');

create index ai_generation_requests_candidate_created_idx
on public.ai_generation_requests (candidate_id, created_at desc);

alter table public.ai_generation_requests enable row level security;

-- Requests are internal orchestration records. The Edge Function uses its
-- server-side service role; desktop clients have no direct table access.
revoke all on table public.ai_generation_requests from anon;
revoke all on table public.ai_generation_requests from authenticated;

comment on table public.ai_generation_requests is
  'Server-only generation state. Never stores prompts, candidate text, or provider responses.';

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

revoke all on function public.store_candidate_ai_summary(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, timestamptz
) from public;
revoke all on function public.store_candidate_ai_summary(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, timestamptz
) from anon;
revoke all on function public.store_candidate_ai_summary(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, timestamptz
) from authenticated;
grant execute on function public.store_candidate_ai_summary(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, timestamptz
) to service_role;

comment on function public.store_candidate_ai_summary(
  uuid, uuid, text, text, text, text, text, text, text, text, text, text, timestamptz
) is 'Server-only atomic replacement of the active candidate AI summary.';
