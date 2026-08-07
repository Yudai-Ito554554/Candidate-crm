-- Phase 3R: support company file lists without scanning unrelated file metadata.

create index if not exists files_company_created_idx
on public.files (company_id, created_at desc)
where archived_at is null;
