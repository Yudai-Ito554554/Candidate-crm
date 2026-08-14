begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(1);

select extensions.ok(
  not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prorettype = 'pg_catalog.trigger'::regtype
      and (
        pg_catalog.has_function_privilege(
          'anon',
          procedure.oid,
          'EXECUTE'
        )
        or pg_catalog.has_function_privilege(
          'authenticated',
          procedure.oid,
          'EXECUTE'
        )
        or exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              procedure.proacl,
              pg_catalog.acldefault('f', procedure.proowner)
            )
          ) as privilege
          where privilege.grantee = 0
            and privilege.privilege_type = 'EXECUTE'
        )
      )
  ),
  'all public trigger functions deny direct execution to PUBLIC, anon, and authenticated'
);

select * from extensions.finish();

rollback;
