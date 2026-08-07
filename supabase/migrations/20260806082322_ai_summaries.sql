-- Phase 3U: server-generated, reviewable candidate AI summaries.

create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id),
  generated_by uuid references auth.users(id) on delete set null,
  model text not null,
  prompt_version text not null,
  candidate_summary text,
  change_reason_summary text,
  strengths text,
  concerns text,
  interview_questions text,
  recommended_jobs text,
  next_action text,
  email_draft text,
  source_activity_through_at timestamptz,
  generated_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_summaries_review_check check (
    (reviewed_at is null and reviewed_by is null)
    or (reviewed_at is not null and reviewed_by is not null)
  )
);

create index ai_summaries_candidate_generated_idx
on public.ai_summaries (candidate_id, generated_at desc)
where archived_at is null;

alter table public.ai_summaries enable row level security;

create policy "authenticated users can read ai summaries"
on public.ai_summaries for select to authenticated using (true);

create policy "editors can review ai summaries"
on public.ai_summaries for update to authenticated
using (
  public.current_profile_role() in ('admin', 'agent')
  and reviewed_by is null
  and reviewed_at is null
)
with check (
  public.current_profile_role() in ('admin', 'agent')
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
);

revoke all on table public.ai_summaries from anon;
revoke insert, delete, truncate on table public.ai_summaries from authenticated;
revoke update on table public.ai_summaries from authenticated;
grant select on table public.ai_summaries to authenticated;
grant update (reviewed_by, reviewed_at) on table public.ai_summaries to authenticated;

-- Generation and archival are server-side operations. The desktop client can
-- read summaries and record a human review, but cannot create or rewrite AI text.
