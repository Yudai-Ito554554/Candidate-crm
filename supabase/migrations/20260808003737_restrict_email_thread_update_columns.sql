-- The initial schema granted authenticated column-scoped UPDATE on
-- public.email_threads (status, archived_at) without first revoking the
-- broader table-level UPDATE that Supabase grants to authenticated by
-- default. Column-level grants are additive, so the wider grant remained
-- in effect and authenticated could update any column, including synced
-- email metadata (subject, external_thread_id, owner_id, etc.).
revoke update on table public.email_threads from authenticated;
grant update (status, archived_at) on table public.email_threads to authenticated;
