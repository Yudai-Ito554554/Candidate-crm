begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(1);

select extensions.ok(
  (
    select count(*) = 51
      and bool_and(
        (
          qual is null
          or qual not ilike '%current_profile_role()%'
          or qual ilike '%select current_profile_role()%'
        )
        and (
          with_check is null
          or with_check not ilike '%current_profile_role()%'
          or with_check ilike '%select current_profile_role()%'
        )
      )
    from pg_policies
    where coalesce(qual, '') ilike '%current_profile_role()%'
      or coalesce(with_check, '') ilike '%current_profile_role()%'
  ),
  'all 51 row-independent current_profile_role policy calls use initplan subqueries'
);

select * from extensions.finish();

rollback;
