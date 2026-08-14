begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(2);

select extensions.is(
  (
    select count(*)
    from pg_policies
    where coalesce(qual, '') ilike '%current_profile_role()%'
      or coalesce(with_check, '') ilike '%current_profile_role()%'
  ),
  51::bigint,
  'exactly 51 policy expressions use current_profile_role'
);

select extensions.ok(
  (
    select bool_and(
        regexp_replace(
          coalesce(qual, ''),
          '\(\s*SELECT\s+current_profile_role\(\)(?:\s+AS\s+current_profile_role)?\s*\)',
          '',
          'gi'
        ) not ilike '%current_profile_role()%'
        and regexp_replace(
          coalesce(with_check, ''),
          '\(\s*SELECT\s+current_profile_role\(\)(?:\s+AS\s+current_profile_role)?\s*\)',
          '',
          'gi'
        ) not ilike '%current_profile_role()%'
      )
    from pg_policies
    where coalesce(qual, '') ilike '%current_profile_role()%'
      or coalesce(with_check, '') ilike '%current_profile_role()%'
  ),
  'every row-independent current_profile_role policy call uses an initplan subquery'
);

select * from extensions.finish();

rollback;
