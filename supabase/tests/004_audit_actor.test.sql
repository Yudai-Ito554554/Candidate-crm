begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(14);

create function pg_temp.set_request_context(
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claim.sub',
    coalesce(target_user_id::text, ''),
    true
  );
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', target_user_id,
      'role', target_role
    )::text,
    true
  );
end;
$$;

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
values
  (
    '40000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'batch4-admin@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'batch4-invited@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '40000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'batch4-other@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

update public.profiles
set role = 'admin'
where id = '40000000-0000-0000-0000-000000000001';

insert into public.candidates (id, owner_id, full_name)
values (
  '41000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'Batch 4 audit fixture'
);

select pg_temp.set_request_context(
  '40000000-0000-0000-0000-000000000001',
  'authenticated'
);
set local role authenticated;

update public.candidates
set full_name = 'Batch 4 user update'
where id = '41000000-0000-0000-0000-000000000001';

reset role;

select extensions.is(
  (
    select actor_kind
    from public.audit_logs
    where entity_id = '41000000-0000-0000-0000-000000000001'
      and action = 'update'
    order by id desc
    limit 1
  ),
  'user'::text,
  'an authenticated candidate update is classified as a user operation'
);

select extensions.is(
  (
    select actor_id
    from public.audit_logs
    where entity_id = '41000000-0000-0000-0000-000000000001'
      and action = 'update'
    order by id desc
    limit 1
  ),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'an authenticated candidate update records the signed-in administrator'
);

select pg_temp.set_request_context(null, 'service_role');
set local role service_role;

select public.apply_invited_profile_role(
  '40000000-0000-0000-0000-000000000002',
  'agent',
  '40000000-0000-0000-0000-000000000001'
);

reset role;

select extensions.is(
  (
    select actor_kind
    from public.audit_logs
    where entity_id = '40000000-0000-0000-0000-000000000002'
      and action = 'role_change'
    order by id desc
    limit 1
  ),
  'service'::text,
  'the invite role RPC is classified as a service operation'
);

select extensions.is(
  (
    select actor_id
    from public.audit_logs
    where entity_id = '40000000-0000-0000-0000-000000000002'
      and action = 'role_change'
    order by id desc
    limit 1
  ),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'the invite role RPC records the verified requester'
);

select pg_temp.set_request_context(
  '40000000-0000-0000-0000-000000000001',
  'authenticated'
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.apply_invited_profile_role(
    '40000000-0000-0000-0000-000000000002',
    'viewer',
    '40000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  null,
  'authenticated users cannot execute the service-only invite role RPC'
);

reset role;
select set_config('app.audit_actor_id', '', true);
select pg_temp.set_request_context(null, 'postgres');

update auth.users
set email = 'batch4-invited-updated@example.invalid'
where id = '40000000-0000-0000-0000-000000000002';

select extensions.is(
  (
    select actor_kind
    from public.audit_logs
    where entity_id = '40000000-0000-0000-0000-000000000002'
      and action = 'update'
      and 'email' = any(changed_fields)
    order by id desc
    limit 1
  ),
  'system'::text,
  'an Auth email synchronization is classified as a system operation'
);

select extensions.is(
  (
    select actor_id
    from public.audit_logs
    where entity_id = '40000000-0000-0000-0000-000000000002'
      and action = 'update'
      and 'email' = any(changed_fields)
    order by id desc
    limit 1
  ),
  null::uuid,
  'an Auth email synchronization does not claim a human actor'
);

select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where actor_id is null
      and actor_kind <> 'system'
  ),
  0::bigint,
  'every audit row without an actor is classified as system'
);

select pg_temp.set_request_context(
  '40000000-0000-0000-0000-000000000001',
  'authenticated'
);
set local role authenticated;
select set_config(
  'app.audit_actor_id',
  '40000000-0000-0000-0000-000000000003',
  true
);

update public.candidates
set full_name = 'Batch 4 spoof attempt'
where id = '41000000-0000-0000-0000-000000000001';

reset role;

select extensions.is(
  (
    select actor_kind
    from public.audit_logs
    where entity_id = '41000000-0000-0000-0000-000000000001'
      and action = 'update'
    order by id desc
    limit 1
  ),
  'user'::text,
  'an authenticated session remains a user operation after setting the service GUC'
);

select extensions.is(
  (
    select actor_id
    from public.audit_logs
    where entity_id = '41000000-0000-0000-0000-000000000001'
      and action = 'update'
    order by id desc
    limit 1
  ),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'auth.uid takes precedence over a spoofed service actor GUC'
);

select set_config('app.audit_actor_id', '', true);
select pg_temp.set_request_context(null, 'service_role');
set local role service_role;

select extensions.throws_ok(
  $$select public.apply_invited_profile_role(
    '40000000-0000-0000-0000-000000000002',
    'admin',
    '40000000-0000-0000-0000-000000000001'
  )$$,
  '22023',
  'invite role must be agent or viewer',
  'the invite role RPC rejects the admin role'
);

select extensions.throws_ok(
  $$select public.apply_invited_profile_role(
    '40000000-0000-0000-0000-000000000002',
    'suspended',
    '40000000-0000-0000-0000-000000000001'
  )$$,
  '22023',
  'invite role must be agent or viewer',
  'the invite role RPC rejects the suspended role'
);

select public.store_candidate_ai_summary(
  '41000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'batch4-test-model',
  'batch4-test-prompt',
  'summary',
  'reason',
  'strengths',
  'concerns',
  'questions',
  'jobs',
  'next action',
  'email draft',
  now()
);

reset role;

select extensions.is(
  (
    select actor_kind
    from public.audit_logs
    where entity_type = 'ai_summary'
      and action = 'create'
    order by id desc
    limit 1
  ),
  'service'::text,
  'the AI summary RPC is classified as a service operation'
);

select extensions.is(
  (
    select actor_id
    from public.audit_logs
    where entity_type = 'ai_summary'
      and action = 'create'
    order by id desc
    limit 1
  ),
  '40000000-0000-0000-0000-000000000001'::uuid,
  'the AI summary RPC records its verified requester'
);

select * from extensions.finish();

rollback;
