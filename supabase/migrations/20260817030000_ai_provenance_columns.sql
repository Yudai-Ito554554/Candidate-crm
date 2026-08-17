-- Batch 6A: AI input provenance. Adds a fingerprint of the exact
-- canonical-serialized string sent to the AI provider, without storing the
-- input itself. Design of record:
-- docs/fable5-design-batch6a-and-cross-cutting-2026-08-15.md section 2.
--
-- Existing rows are left NULL. A row created before this migration has no
-- recorded canonical input, so its fingerprint cannot be computed and must
-- not be backfilled with a guessed value.

alter table public.ai_generation_requests
  add column input_fingerprint text,
  add column hash_algorithm text,
  add column hash_key_version integer,
  add column redaction_version text,
  add column input_schema_version text;

alter table public.ai_generation_requests
  add constraint ai_generation_requests_fingerprint_format_check check (
    input_fingerprint is null or input_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  add constraint ai_generation_requests_hash_algorithm_check check (
    hash_algorithm is null or hash_algorithm in ('hmac-sha256')
  ),
  add constraint ai_generation_requests_hash_key_version_check check (
    hash_key_version is null or hash_key_version >= 1
  ),
  add constraint ai_generation_requests_redaction_version_format_check check (
    redaction_version is null or redaction_version ~ '^[a-z0-9-]+/[0-9]+$'
  ),
  add constraint ai_generation_requests_input_schema_version_format_check check (
    input_schema_version is null or input_schema_version ~ '^[a-z0-9-]+/[0-9]+$'
  ),
  add constraint ai_generation_requests_provenance_complete_check check (
    (
      input_fingerprint is null
      and hash_algorithm is null
      and hash_key_version is null
      and redaction_version is null
      and input_schema_version is null
    )
    or (
      input_fingerprint is not null
      and hash_algorithm is not null
      and hash_key_version is not null
      and redaction_version is not null
      and input_schema_version is not null
    )
  );

comment on column public.ai_generation_requests.input_fingerprint is
  'HMAC-SHA-256 (server-only key) of the canonical-serialized string sent to the AI provider. NULL when no send occurred (existing rows, pre-send failures).';

alter table public.job_import_requests
  add column input_fingerprint text,
  add column hash_algorithm text,
  add column hash_key_version integer,
  add column redaction_version text,
  add column input_schema_version text;

alter table public.job_import_requests
  add constraint job_import_requests_fingerprint_format_check check (
    input_fingerprint is null or input_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  add constraint job_import_requests_hash_algorithm_check check (
    hash_algorithm is null or hash_algorithm in ('hmac-sha256')
  ),
  add constraint job_import_requests_hash_key_version_check check (
    hash_key_version is null or hash_key_version >= 1
  ),
  add constraint job_import_requests_redaction_version_format_check check (
    redaction_version is null or redaction_version ~ '^[a-z0-9-]+/[0-9]+$'
  ),
  add constraint job_import_requests_input_schema_version_format_check check (
    input_schema_version is null or input_schema_version ~ '^[a-z0-9-]+/[0-9]+$'
  ),
  add constraint job_import_requests_provenance_complete_check check (
    (
      input_fingerprint is null
      and hash_algorithm is null
      and hash_key_version is null
      and redaction_version is null
      and input_schema_version is null
    )
    or (
      input_fingerprint is not null
      and hash_algorithm is not null
      and hash_key_version is not null
      and redaction_version is not null
      and input_schema_version is not null
    )
  );

comment on column public.job_import_requests.input_fingerprint is
  'HMAC-SHA-256 (server-only key) of the canonical-serialized string sent to the AI provider. NULL when no send occurred (existing rows, pre-send failures).';

-- Column additions do not change table-level GRANTs, but the additive
-- nature of PostgreSQL GRANTs has caused a production incident before
-- (see migrations 20260808003737 and 20260808043603). Re-assert explicitly
-- that desktop clients still have no access to either table.
revoke all on table public.ai_generation_requests from anon;
revoke all on table public.ai_generation_requests from authenticated;
revoke all on table public.job_import_requests from anon;
revoke all on table public.job_import_requests from authenticated;
