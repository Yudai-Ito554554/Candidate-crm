begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(12);

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '60000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'batch6a-requester@example.invalid',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

insert into public.candidates (id, full_name)
values (
  '61000000-0000-0000-0000-000000000001',
  'Batch 6A provenance fixture'
);

-- 1-2: the five provenance columns exist on both tables with the expected
-- PostgreSQL types.
select extensions.ok(
  (
    select count(*) = 5
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ai_generation_requests'
      and (
        (column_name = 'input_fingerprint' and data_type = 'text')
        or (column_name = 'hash_algorithm' and data_type = 'text')
        or (column_name = 'hash_key_version' and data_type = 'integer')
        or (column_name = 'redaction_version' and data_type = 'text')
        or (column_name = 'input_schema_version' and data_type = 'text')
      )
  ),
  'ai_generation_requests has the five provenance columns with expected types'
);

select extensions.ok(
  (
    select count(*) = 5
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'job_import_requests'
      and (
        (column_name = 'input_fingerprint' and data_type = 'text')
        or (column_name = 'hash_algorithm' and data_type = 'text')
        or (column_name = 'hash_key_version' and data_type = 'integer')
        or (column_name = 'redaction_version' and data_type = 'text')
        or (column_name = 'input_schema_version' and data_type = 'text')
      )
  ),
  'job_import_requests has the five provenance columns with expected types'
);

-- 3-4: all-or-nothing. A row with some provenance columns set and others
-- left NULL is rejected on both tables.
select extensions.throws_ok(
  $$
  insert into public.ai_generation_requests (
    candidate_id, input_fingerprint, hash_algorithm
  ) values (
    '61000000-0000-0000-0000-000000000001',
    repeat('a', 64),
    'hmac-sha256'
  )
  $$,
  '23514',
  null,
  'ai_generation_requests rejects a partially-populated provenance row'
);

select extensions.throws_ok(
  $$
  insert into public.job_import_requests (
    requested_by, source_type, input_fingerprint, hash_algorithm
  ) values (
    '60000000-0000-0000-0000-000000000001',
    'text',
    repeat('a', 64),
    'hmac-sha256'
  )
  $$,
  '23514',
  null,
  'job_import_requests rejects a partially-populated provenance row'
);

-- 5-7: fingerprint format violations (non-hex, 63 digits, uppercase).
select extensions.throws_ok(
  $$
  insert into public.ai_generation_requests (
    candidate_id, input_fingerprint, hash_algorithm, hash_key_version,
    redaction_version, input_schema_version
  ) values (
    '61000000-0000-0000-0000-000000000001',
    repeat('g', 64),
    'hmac-sha256',
    1,
    'candidate-summary/1',
    'candidate-summary/1'
  )
  $$,
  '23514',
  null,
  'ai_generation_requests rejects a non-hex fingerprint'
);

select extensions.throws_ok(
  $$
  insert into public.ai_generation_requests (
    candidate_id, input_fingerprint, hash_algorithm, hash_key_version,
    redaction_version, input_schema_version
  ) values (
    '61000000-0000-0000-0000-000000000001',
    repeat('a', 63),
    'hmac-sha256',
    1,
    'candidate-summary/1',
    'candidate-summary/1'
  )
  $$,
  '23514',
  null,
  'ai_generation_requests rejects a 63-character fingerprint'
);

select extensions.throws_ok(
  $$
  insert into public.ai_generation_requests (
    candidate_id, input_fingerprint, hash_algorithm, hash_key_version,
    redaction_version, input_schema_version
  ) values (
    '61000000-0000-0000-0000-000000000001',
    upper(repeat('a', 64)),
    'hmac-sha256',
    1,
    'candidate-summary/1',
    'candidate-summary/1'
  )
  $$,
  '23514',
  null,
  'ai_generation_requests rejects an uppercase-hex fingerprint'
);

-- 8: unexpected hash_algorithm value is rejected.
select extensions.throws_ok(
  $$
  insert into public.job_import_requests (
    requested_by, source_type, input_fingerprint, hash_algorithm,
    hash_key_version, redaction_version, input_schema_version
  ) values (
    '60000000-0000-0000-0000-000000000001',
    'text',
    repeat('a', 64),
    'sha256',
    1,
    'job-import/1',
    'job-import/1'
  )
  $$,
  '23514',
  null,
  'job_import_requests rejects an unsupported hash_algorithm value'
);

-- 9-10: a fully-populated provenance row is accepted on both tables.
select extensions.lives_ok(
  $$
  insert into public.ai_generation_requests (
    candidate_id, input_fingerprint, hash_algorithm, hash_key_version,
    redaction_version, input_schema_version
  ) values (
    '61000000-0000-0000-0000-000000000001',
    repeat('a', 64),
    'hmac-sha256',
    1,
    'candidate-summary/1',
    'candidate-summary/1'
  )
  $$,
  'ai_generation_requests accepts a fully-populated provenance row'
);

select extensions.lives_ok(
  $$
  insert into public.job_import_requests (
    requested_by, source_type, input_fingerprint, hash_algorithm,
    hash_key_version, redaction_version, input_schema_version
  ) values (
    '60000000-0000-0000-0000-000000000001',
    'text',
    repeat('a', 64),
    'hmac-sha256',
    1,
    'job-import/1',
    'job-import/1'
  )
  $$,
  'job_import_requests accepts a fully-populated provenance row'
);

-- 11-12: the column additions did not widen table-level privileges. Desktop
-- clients (anon, authenticated) still cannot read or write either table.
select extensions.ok(
  not has_table_privilege('anon', 'public.ai_generation_requests', 'SELECT')
  and not has_table_privilege('anon', 'public.ai_generation_requests', 'INSERT')
  and not has_table_privilege('anon', 'public.ai_generation_requests', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.ai_generation_requests', 'SELECT')
  and not has_table_privilege('authenticated', 'public.ai_generation_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.ai_generation_requests', 'UPDATE'),
  'ai_generation_requests remains server-only after adding provenance columns'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.job_import_requests', 'SELECT')
  and not has_table_privilege('anon', 'public.job_import_requests', 'INSERT')
  and not has_table_privilege('anon', 'public.job_import_requests', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.job_import_requests', 'SELECT')
  and not has_table_privilege('authenticated', 'public.job_import_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.job_import_requests', 'UPDATE'),
  'job_import_requests remains server-only after adding provenance columns'
);

select * from extensions.finish();

rollback;
