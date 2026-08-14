-- Trigger execution is performed by PostgreSQL and does not require callers to
-- hold EXECUTE on the trigger function. Remove the unintended RPC surface.

revoke execute on function public.set_updated_at()
from public, anon, authenticated;

-- If future Gmail or Outlook synchronization must call this function directly,
-- add a reviewed, explicit service_role grant in a new migration. The current
-- trigger-only synchronization path does not require one.
revoke execute on function public.refresh_email_thread_from_message()
from public, anon, authenticated;

revoke execute on function public.validate_application_relation()
from public, anon, authenticated;

revoke execute on function public.prevent_referenced_application_identity_change()
from public, anon, authenticated;

revoke execute on function public.validate_job_contact_company()
from public, anon, authenticated;

revoke execute on function public.prevent_archiving_referenced_records()
from public, anon, authenticated;
