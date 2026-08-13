begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(1);

select extensions.ok(
  (
    select count(*) = 51
      and bool_and(
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
  'all 51 row-independent current_profile_role policy calls use initplan subqueries'
);

select * from extensions.finish();

rollback;
