-- Phase 4F: address actionable Supabase security and foreign-key advisor findings.

-- Trigger functions do not need to be callable through the Data API.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- RLS policies need authenticated execution, but anonymous users must not be
-- able to invoke this SECURITY DEFINER helper through the Data API.
revoke all on function public.current_profile_role() from public, anon;
grant execute on function public.current_profile_role() to authenticated;

-- PostgreSQL does not automatically index foreign-key columns. These indexes
-- cover joins and referential actions that are not already covered by a leading
-- column in an existing index.
create index activities_application_idx
  on public.activities (application_id);
create index activities_job_idx
  on public.activities (job_id);
create index activities_owner_idx
  on public.activities (owner_id);
create index ai_generation_requests_requested_by_idx
  on public.ai_generation_requests (requested_by);
create index ai_summaries_generated_by_idx
  on public.ai_summaries (generated_by);
create index ai_summaries_reviewed_by_idx
  on public.ai_summaries (reviewed_by);
create index application_status_history_changed_by_idx
  on public.application_status_history (changed_by);
create index applications_owner_idx
  on public.applications (owner_id);
create index candidate_views_candidate_idx
  on public.candidate_views (candidate_id);
create index email_messages_activity_idx
  on public.email_messages (activity_id);
create index email_threads_application_idx
  on public.email_threads (application_id);
create index email_threads_job_idx
  on public.email_threads (job_id);
create index email_threads_owner_idx
  on public.email_threads (owner_id);
create index files_application_idx
  on public.files (application_id);
create index files_owner_idx
  on public.files (owner_id);
create index jobs_contact_idx
  on public.jobs (contact_id);
create index jobs_owner_idx
  on public.jobs (owner_id);
create index tasks_application_idx
  on public.tasks (application_id);
create index tasks_company_idx
  on public.tasks (company_id);
create index tasks_job_idx
  on public.tasks (job_id);
