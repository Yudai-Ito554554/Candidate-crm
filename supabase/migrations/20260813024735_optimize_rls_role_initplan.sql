-- Batch 3: cache the row-independent role lookup once per statement.
--
-- Only the invocation shape changes. Every USING and WITH CHECK predicate keeps
-- its existing boolean logic and role allow-list.

alter policy "workspace members can read profiles"
on public.profiles
using (
  id = (select auth.uid())
  or (select public.current_profile_role()) in ('admin', 'agent', 'viewer')
);

alter policy "workspace members can read candidates"
on public.candidates
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert candidates"
on public.candidates
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update candidates"
on public.candidates
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read candidate experiences"
on public.candidate_experiences
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert candidate experiences"
on public.candidate_experiences
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update candidate experiences"
on public.candidate_experiences
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read companies"
on public.companies
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert companies"
on public.companies
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update companies"
on public.companies
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read company contacts"
on public.company_contacts
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert company contacts"
on public.company_contacts
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update company contacts"
on public.company_contacts
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read jobs"
on public.jobs
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert jobs"
on public.jobs
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update jobs"
on public.jobs
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read applications"
on public.applications
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert applications"
on public.applications
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update applications"
on public.applications
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read activities"
on public.activities
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert activities"
on public.activities
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update activities"
on public.activities
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read tasks"
on public.tasks
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert tasks"
on public.tasks
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update tasks"
on public.tasks
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read files"
on public.files
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert files"
on public.files
with check (
  (select public.current_profile_role()) in ('admin', 'agent')
  and (select auth.uid()) = owner_id
);
alter policy "editors can update files"
on public.files
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read email threads"
on public.email_threads
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can update email thread workflow"
on public.email_threads
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read email messages"
on public.email_messages
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));

alter policy "workspace members can read tags"
on public.tags
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert tags"
on public.tags
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update tags"
on public.tags
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read candidate tags"
on public.candidate_tags
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert candidate tags"
on public.candidate_tags
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update candidate tags"
on public.candidate_tags
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read company tags"
on public.company_tags
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert company tags"
on public.company_tags
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update company tags"
on public.company_tags
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read job tags"
on public.job_tags
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can insert job tags"
on public.job_tags
with check ((select public.current_profile_role()) in ('admin', 'agent'));
alter policy "editors can update job tags"
on public.job_tags
using ((select public.current_profile_role()) in ('admin', 'agent'))
with check ((select public.current_profile_role()) in ('admin', 'agent'));

alter policy "workspace members can read application status history"
on public.application_status_history
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));

alter policy "workspace members can read their own candidate views"
on public.candidate_views
using (
  (select auth.uid()) = user_id
  and (select public.current_profile_role()) in ('admin', 'agent', 'viewer')
);

alter policy "workspace members can read ai summaries"
on public.ai_summaries
using ((select public.current_profile_role()) in ('admin', 'agent', 'viewer'));
alter policy "editors can review ai summaries"
on public.ai_summaries
using (
  (select public.current_profile_role()) in ('admin', 'agent')
  and reviewed_by is null
  and reviewed_at is null
)
with check (
  (select public.current_profile_role()) in ('admin', 'agent')
  and reviewed_by = (select auth.uid())
  and reviewed_at is not null
);

alter policy "administrators can read audit logs"
on public.audit_logs
using ((select public.current_profile_role()) = 'admin');

alter policy "workspace members can read crm files"
on storage.objects
using (
  bucket_id = 'crm-files'
  and (select public.current_profile_role()) in ('admin', 'agent', 'viewer')
);
alter policy "editors can upload crm files"
on storage.objects
with check (
  bucket_id = 'crm-files'
  and (select public.current_profile_role()) in ('admin', 'agent')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
alter policy "editors can clean up their failed crm uploads"
on storage.objects
using (
  bucket_id = 'crm-files'
  and (select public.current_profile_role()) in ('admin', 'agent')
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
