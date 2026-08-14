begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(1);

-- EXPLAIN wording may change across PostgreSQL major versions. If this proof
-- fails after an upgrade, check 002_rls_initplan.test.sql first: a passing 002
-- means policy shape is still protected and this plan-text assertion needs
-- maintenance rather than an immediate policy rewrite.

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
  '30000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'batch3-admin@example.invalid',
  '',
  now(),
  '{}',
  '{}',
  now(),
  now()
);

update public.profiles
set role = 'admin'
where id = '30000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '30000000-0000-0000-0000-000000000001',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

create temporary table batch3_explain_lines (line text not null);

do $$
declare
  explain_record record;
begin
  for explain_record in
    execute $explain$
      explain (costs off)
      select id, full_name
      from public.candidates
      where archived_at is null
      order by updated_at desc
      limit 50
    $explain$
  loop
    insert into batch3_explain_lines (line)
    values (explain_record."QUERY PLAN");
  end loop;
end;
$$;

select extensions.ok(
  exists (
    select 1
    from batch3_explain_lines
    where line like '%InitPlan%'
  ),
  'the authenticated candidate list plan caches the role lookup as an InitPlan'
);

select * from extensions.finish();

rollback;
