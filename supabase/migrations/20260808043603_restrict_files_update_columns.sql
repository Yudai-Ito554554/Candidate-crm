-- The initial schema granted authenticated column-scoped UPDATE on
-- public.files (archived_at) without first revoking the broader
-- table-level UPDATE that Supabase grants to authenticated by default.
-- Column-level grants are additive, so the wider grant remained in
-- effect and authenticated could update any column, including
-- storage_path, file_size, mime_type, and owner_id.
revoke update on table public.files from authenticated;
grant update (archived_at) on table public.files to authenticated;
