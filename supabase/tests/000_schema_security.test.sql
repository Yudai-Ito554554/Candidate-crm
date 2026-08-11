begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(29);

select extensions.ok(
  to_regclass('public.candidates') is not null,
  'candidates table exists'
);

select extensions.ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidates'
      and column_name = 'private_notes'
  )
  and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'candidates'
      and column_name = 'notes'
  ),
  'candidate internal notes use the unambiguous private_notes column'
);

select extensions.ok(
  (
    select count(*) = 7
    from pg_constraint as constraint_record
    join pg_class as source_table
      on source_table.oid = constraint_record.conrelid
    join pg_namespace as source_schema
      on source_schema.oid = source_table.relnamespace
    join unnest(constraint_record.conkey) as source_key(attribute_number)
      on true
    join pg_attribute as source_column
      on source_column.attrelid = source_table.oid
      and source_column.attnum = source_key.attribute_number
    where constraint_record.contype = 'f'
      and source_schema.nspname = 'public'
      and source_column.attname = 'owner_id'
      and constraint_record.confrelid = 'auth.users'::regclass
  ),
  'all seven business owner_id foreign keys reference auth.users'
);

select extensions.ok(
  not exists (
    select 1
    from pg_constraint as constraint_record
    join pg_class as source_table
      on source_table.oid = constraint_record.conrelid
    join unnest(constraint_record.conkey) as source_key(attribute_number)
      on true
    join pg_attribute as source_column
      on source_column.attrelid = source_table.oid
      and source_column.attnum = source_key.attribute_number
    where constraint_record.contype = 'f'
      and source_column.attname = 'owner_id'
      and constraint_record.confrelid = 'public.profiles'::regclass
  ),
  'owner_id never references profiles'
);

select extensions.ok(
  exists (
    select 1
    from pg_attribute
    where attrelid = 'public.tasks'::regclass
      and attname = 'task_type'
      and attnotnull
      and not attisdropped
  ),
  'task_type is required'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.activities'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%meeting%'
  ),
  'activity_type accepts meeting'
);

select extensions.ok(
  exists (
    select 1
    from pg_attribute as column_record
    join pg_attrdef as default_record
      on default_record.adrelid = column_record.attrelid
      and default_record.adnum = column_record.attnum
    where column_record.attrelid = 'public.activities'::regclass
      and column_record.attname = 'ai_generated'
      and column_record.attnotnull
      and pg_get_expr(default_record.adbin, default_record.adrelid) = 'false'
  ),
  'activity AI provenance is required and defaults to false'
);

select extensions.ok(
  (
    select count(*) = 5
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'companies'
      and column_name in ('industry', 'employees', 'capital', 'listed', 'website')
  ),
  'company enrichment fields exist'
);

select extensions.ok(
  (
    select count(*) = 4
    from pg_class as table_record
    join pg_namespace as schema_record
      on schema_record.oid = table_record.relnamespace
    where schema_record.nspname = 'public'
      and table_record.relkind = 'r'
      and table_record.relname in ('tags', 'candidate_tags', 'company_tags', 'job_tags')
  ),
  'normalized tag tables exist'
);

select extensions.ok(
  (
    select count(*) = 22 and bool_and(table_record.relrowsecurity)
    from unnest(array[
      'profiles', 'candidates', 'candidate_experiences', 'companies',
      'company_contacts', 'jobs', 'applications', 'activities', 'tasks',
      'files', 'email_threads', 'email_messages', 'tags', 'candidate_tags',
      'company_tags', 'job_tags', 'application_status_history',
      'candidate_views', 'ai_summaries', 'audit_logs', 'ai_generation_requests',
      'job_import_requests'
    ]) as expected(table_name)
    join pg_class as table_record
      on table_record.relname = expected.table_name
    join pg_namespace as schema_record
      on schema_record.oid = table_record.relnamespace
      and schema_record.nspname = 'public'
  ),
  'RLS is enabled on every CRM table'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.candidates', 'SELECT')
  and not has_table_privilege('anon', 'public.candidates', 'INSERT')
  and not has_table_privilege('anon', 'public.candidates', 'UPDATE')
  and not has_table_privilege('anon', 'public.candidates', 'DELETE'),
  'anon has no candidate table privileges'
);

select extensions.ok(
  not has_table_privilege('authenticated', 'public.candidates', 'DELETE')
  and not has_table_privilege('authenticated', 'public.application_status_history', 'INSERT')
  and not has_table_privilege('authenticated', 'public.audit_logs', 'INSERT')
  and not has_table_privilege('authenticated', 'public.ai_generation_requests', 'SELECT'),
  'desktop clients cannot delete candidates or mutate server-owned records'
);

select extensions.ok(
  not has_table_privilege('anon', 'public.job_import_requests', 'SELECT')
  and not has_table_privilege('authenticated', 'public.job_import_requests', 'SELECT')
  and not has_table_privilege('authenticated', 'public.job_import_requests', 'INSERT')
  and not has_table_privilege('authenticated', 'public.job_import_requests', 'UPDATE'),
  'job import usage metadata is server-only'
);

select extensions.ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'job_import_requests'
      and column_name in (
        'source_text', 'source_url', 'file_name', 'prompt', 'response',
        'extracted_data'
      )
  ),
  'job import requests do not persist source or extracted content'
);

select extensions.ok(
  position(
    'pg_advisory_xact_lock'
    in lower(pg_get_functiondef('private.prepare_ai_usage_quota(uuid,timestamp with time zone)'::regprocedure))
  ) > 0
  and position(
    'interval ''1 hour'''
    in lower(pg_get_functiondef('private.prepare_ai_usage_quota(uuid,timestamp with time zone)'::regprocedure))
  ) > 0
  and position(
    'interval ''1 day'''
    in lower(pg_get_functiondef('private.prepare_ai_usage_quota(uuid,timestamp with time zone)'::regprocedure))
  ) > 0,
  'shared AI quotas are serialized and time-bounded'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.claim_job_import_request(uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.claim_job_import_request(uuid,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.claim_job_import_request(uuid,text)',
    'EXECUTE'
  ),
  'only the service role can claim a job import quota slot'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.claim_candidate_ai_request(uuid,uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.claim_candidate_ai_request(uuid,uuid)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.claim_candidate_ai_request(uuid,uuid)',
    'EXECUTE'
  ),
  'only the service role can claim a candidate AI slot'
);

select extensions.ok(
  position(
    'private.prepare_ai_usage_quota'
    in lower(pg_get_functiondef('public.claim_candidate_ai_request(uuid,uuid)'::regprocedure))
  ) > 0
  and position(
    'interval ''5 minutes'''
    in lower(pg_get_functiondef('public.claim_candidate_ai_request(uuid,uuid)'::regprocedure))
  ) > 0
  and position(
    'private.prepare_ai_usage_quota'
    in lower(pg_get_functiondef('public.claim_job_import_request(uuid,text)'::regprocedure))
  ) > 0,
  'candidate summaries and job imports use the same quota helper'
);

select extensions.ok(
  not has_function_privilege(
    'anon',
    'public.get_ai_usage_snapshot()',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.get_ai_usage_snapshot()',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.get_ai_usage_snapshot()',
    'EXECUTE'
  ),
  'only the service role can read aggregate AI usage'
);

select extensions.ok(
  exists (
    select 1
    from pg_proc as function_record
    join pg_namespace as schema_record
      on schema_record.oid = function_record.pronamespace
    where schema_record.nspname = 'public'
      and function_record.proname = 'search_crm'
      and not function_record.prosecdef
  ),
  'global search runs as security invoker'
);

select extensions.ok(
  position(
    'is distinct from ''admin'''
    in lower(pg_get_functiondef('public.set_profile_role(uuid,text)'::regprocedure))
  ) > 0
  and position(
    'pg_advisory_xact_lock'
    in lower(pg_get_functiondef('public.set_profile_role(uuid,text)'::regprocedure))
  ) > 0,
  'profile role changes fail closed and serialize final-admin protection'
);

select extensions.ok(
  (
    select column_default = '''pending''::text'
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'role'
  ),
  'new profiles default to pending approval'
);

select extensions.ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%suspended%'
  )
  and position(
    '''suspended'''
    in lower(pg_get_functiondef('public.set_profile_role(uuid,text)'::regprocedure))
  ) > 0,
  'suspended is a distinct profile role that administrators can assign'
);

select extensions.ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidates'
      and policyname = 'workspace members can read candidates'
      and qual like '%current_profile_role%'
  ),
  'candidate reads require approved workspace membership'
);

select extensions.ok(
  position(
    'last_message_preview is null'
    in lower(pg_get_functiondef('public.refresh_email_thread_from_message()'::regprocedure))
  ) > 0,
  'historical email imports initialize thread summaries'
);

select extensions.ok(
  not has_function_privilege('anon', 'public.current_profile_role()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE'),
  'anonymous users cannot execute role helpers and trigger functions are not API-callable'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'on_auth_user_email_updated'
      and not tgisinternal
      and lower(pg_get_triggerdef(oid)) like '%after update of email%'
      and lower(pg_get_triggerdef(oid)) like '%old.email is distinct from new.email%'
  )
  and not has_function_privilege(
    'authenticated',
    'public.sync_profile_email_from_auth()',
    'EXECUTE'
  ),
  'Auth email changes synchronize profiles through a non-callable trigger helper'
);

select extensions.ok(
  exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.jobs'::regclass
      and tgname = 'jobs_validate_restore_dependencies'
      and not tgisinternal
  )
  and not has_function_privilege(
    'authenticated',
    'public.validate_job_restore_dependencies()',
    'EXECUTE'
  ),
  'job restore dependencies are enforced without exposing the trigger function'
);

select extensions.ok(
  not exists (
    select 1
    from pg_constraint as constraint_record
    where constraint_record.contype = 'f'
      and constraint_record.connamespace = 'public'::regnamespace
      and not exists (
        select 1
        from pg_index as index_record
        where index_record.indrelid = constraint_record.conrelid
          and index_record.indisvalid
          and cardinality(constraint_record.conkey) = 1
          and index_record.indkey[0] = constraint_record.conkey[1]
      )
  ),
  'every public foreign key has a covering index'
);

select * from extensions.finish();

rollback;
