-- Restrict the invite-only role transition to newly created pending profiles.
-- A missing profile and an already-processed profile intentionally share P0002
-- so the service caller cannot use this RPC to probe current profile state.

create or replace function public.apply_invited_profile_role(
  target_user_id uuid,
  new_role text,
  requester_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform set_config('app.audit_actor_id', requester_id::text, true);

  if new_role is null or new_role not in ('agent', 'viewer') then
    raise exception using
      errcode = '22023',
      message = 'invite role must be agent or viewer';
  end if;

  update public.profiles
  set role = new_role
  where id = target_user_id
    and role = 'pending';

  if not found then
    raise exception using
      errcode = 'P0002',
      message = 'invited profile not found';
  end if;
end;
$$;

revoke all on function public.apply_invited_profile_role(uuid, text, uuid)
from public, anon, authenticated;
grant execute on function public.apply_invited_profile_role(uuid, text, uuid)
to service_role;

comment on function public.apply_invited_profile_role(uuid, text, uuid) is
  'Service-only pending invite role assignment with verified requester attribution.';
