begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(7);

-- S3-3の合格条件(2)。viewerが業務テーブルへ書き込めないことをRLSの実行で固定する。
-- 002/003は51 policyがcurrent_profile_role()を参照することを構造として確認しているが、
-- viewerロールで実際にINSERT/UPDATEを試みる検証は存在しなかった。
-- 参照: docs/fable5-decision-s3-3-2026-08-19.md 3節

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
    '70000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    's33-viewer@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    's33-agent@example.invalid',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

update public.profiles
set role = case id
  when '70000000-0000-0000-0000-000000000001' then 'viewer'
  else 'agent'
end
where id in (
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002'
);

insert into public.candidates (id, owner_id, full_name)
values (
  '71000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  'S3-3 viewer fixture'
);

insert into public.companies (id, name)
values (
  '72000000-0000-0000-0000-000000000001',
  'S3-3 viewer fixture company'
);

select pg_temp.set_authenticated_user(
  '70000000-0000-0000-0000-000000000001'
);
set local role authenticated;

-- 読み取りは可能であること。書き込み拒否が「viewerだから」であって
-- 「fixtureが見えていないから」ではないことを先に固定する。
select extensions.is(
  (select count(*) from public.candidates),
  1::bigint,
  'a viewer account can read candidates'
);

select extensions.is(
  (select count(*) from public.companies),
  1::bigint,
  'a viewer account can read companies'
);

select extensions.throws_ok(
  $$insert into public.candidates (full_name)
    values ('Viewer insert must fail')$$,
  '42501',
  null,
  'a viewer account cannot insert candidates'
);

select extensions.throws_ok(
  $$insert into public.companies (name)
    values ('Viewer insert must fail')$$,
  '42501',
  null,
  'a viewer account cannot insert companies'
);

select extensions.throws_ok(
  $$insert into public.jobs (company_id, title)
    values (
      '72000000-0000-0000-0000-000000000001',
      'Viewer insert must fail'
    )$$,
  '42501',
  null,
  'a viewer account cannot insert jobs'
);

-- UPDATEはUSING句に一致する行が無いため0行更新で終わり、エラーにはならない。
-- 行が書き換わっていないことをもって拒否を確認する。
update public.candidates
set full_name = 'Viewer update must not apply'
where id = '71000000-0000-0000-0000-000000000001';

select extensions.is(
  (
    select full_name
    from public.candidates
    where id = '71000000-0000-0000-0000-000000000001'
  ),
  'S3-3 viewer fixture'::text,
  'a viewer account cannot update candidates'
);

update public.companies
set name = 'Viewer update must not apply'
where id = '72000000-0000-0000-0000-000000000001';

select extensions.is(
  (
    select name
    from public.companies
    where id = '72000000-0000-0000-0000-000000000001'
  ),
  'S3-3 viewer fixture company'::text,
  'a viewer account cannot update companies'
);

reset role;

select * from extensions.finish();

rollback;
