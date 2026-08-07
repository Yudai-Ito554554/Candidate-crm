-- Phase 4C: fail closed on missing profiles and serialize administrator changes.

create or replace function public.set_profile_role(
  target_user_id uuid,
  new_role text
)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  updated_profile public.profiles;
begin
  if public.current_profile_role() is distinct from 'admin' then
    raise exception 'administrator role required' using errcode = '42501';
  end if;

  if new_role not in ('admin', 'agent', 'viewer') then
    raise exception 'invalid profile role' using errcode = '22023';
  end if;

  -- Serialize all role changes so two administrators cannot concurrently
  -- demote themselves and leave the workspace without an administrator.
  perform pg_advisory_xact_lock(20260806000900);

  if new_role <> 'admin'
     and (select role from public.profiles where id = target_user_id) = 'admin'
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'the final administrator cannot be demoted'
      using errcode = '23514';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  return updated_profile;
end;
$$;

revoke all on function public.set_profile_role(uuid, text) from public, anon;
grant execute on function public.set_profile_role(uuid, text) to authenticated;

comment on function public.set_profile_role(uuid, text) is
  'Admin-only role change with fail-closed authorization and serialized final-admin protection.';
