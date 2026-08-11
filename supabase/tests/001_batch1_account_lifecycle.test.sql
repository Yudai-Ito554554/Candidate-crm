begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(13);

create function pg_temp.set_authenticated_user(target_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'request.jwt.claim.sub',
    target_user_id::text,
    true
  );
  perform set_config(
    'request.jwt.claims',
    json_build_object(
      'sub', target_user_id::text,
      'role', 'authenticated'
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
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'batch1-admin@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'batch1-suspended@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'batch1-pending@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

update public.profiles
set role = case id
  when '10000000-0000-0000-0000-000000000001' then 'admin'
  when '10000000-0000-0000-0000-000000000002' then 'suspended'
  else 'pending'
end
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000003'
);

insert into public.candidates (id, owner_id, full_name)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Batch 1 access fixture'
);

insert into storage.objects (bucket_id, name)
values (
  'crm-files',
  '10000000-0000-0000-0000-000000000001/batch1-access-fixture.pdf'
);

select pg_temp.set_authenticated_user(
  '10000000-0000-0000-0000-000000000001'
);
set local role authenticated;

select extensions.throws_ok(
  $$select public.set_profile_role(
    '10000000-0000-0000-0000-000000000001',
    'suspended'
  )$$,
  '23514',
  'the final administrator cannot be demoted',
  'the final administrator cannot suspend their own account'
);

reset role;
select pg_temp.set_authenticated_user(
  '10000000-0000-0000-0000-000000000002'
);
set local role authenticated;

select extensions.is(
  (select count(*) from public.candidates),
  0::bigint,
  'a suspended account cannot read candidates'
);

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'a suspended account can read only its own profile'
);

select extensions.throws_ok(
  $$insert into public.candidates (full_name)
    values ('Suspended insert must fail')$$,
  '42501',
  null,
  'a suspended account cannot insert candidates'
);

select extensions.is(
  (
    select count(*)
    from storage.objects
    where bucket_id = 'crm-files'
  ),
  0::bigint,
  'a suspended account cannot read private CRM storage objects'
);

select extensions.throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values (
      'crm-files',
      '10000000-0000-0000-0000-000000000002/suspended-upload.pdf'
    )$$,
  '42501',
  null,
  'a suspended account cannot upload private CRM storage objects'
);

select extensions.throws_ok(
  $$select public.record_candidate_view(
    '20000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'approved workspace membership required',
  'a suspended account cannot bypass RLS through record_candidate_view'
);

update public.candidates
set full_name = 'Suspended update must not apply'
where id = '20000000-0000-0000-0000-000000000001';

reset role;

select extensions.is(
  (
    select full_name
    from public.candidates
    where id = '20000000-0000-0000-0000-000000000001'
  ),
  'Batch 1 access fixture'::text,
  'a suspended account cannot update candidates'
);

select pg_temp.set_authenticated_user(
  '10000000-0000-0000-0000-000000000003'
);
set local role authenticated;

select extensions.is(
  (select count(*) from public.candidates),
  0::bigint,
  'a pending account remains unable to read candidates'
);

select extensions.is(
  (select count(*) from public.profiles),
  1::bigint,
  'a pending account can read only its own profile'
);

select extensions.throws_ok(
  $$insert into public.candidates (full_name)
    values ('Pending insert must fail')$$,
  '42501',
  null,
  'a pending account remains unable to insert candidates'
);

reset role;

create temporary table batch1_audit_baseline (profile_updates bigint not null);

insert into batch1_audit_baseline (profile_updates)
select count(*)
from public.audit_logs
where entity_id = '10000000-0000-0000-0000-000000000002'
  and action = 'update';

update auth.users
set last_sign_in_at = now()
where id = '10000000-0000-0000-0000-000000000002';

select extensions.is(
  (
    select count(*)
    from public.audit_logs
    where entity_id = '10000000-0000-0000-0000-000000000002'
      and action = 'update'
  ),
  (select profile_updates from batch1_audit_baseline),
  'non-email Auth updates do not touch the profile row'
);

update auth.users
set email = 'batch1-suspended-updated@example.invalid'
where id = '10000000-0000-0000-0000-000000000002';

select extensions.is(
  (
    select email
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000002'
  ),
  'batch1-suspended-updated@example.invalid'::text,
  'Auth email updates synchronize the display-only profile email'
);

select * from extensions.finish();

rollback;
