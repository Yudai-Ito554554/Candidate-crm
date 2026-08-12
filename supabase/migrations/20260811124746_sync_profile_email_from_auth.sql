-- Keep the display-only profile email aligned with the Auth identity record.

create or replace function public.sync_profile_email_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set email = new.email
  where id = new.id
    and email is distinct from new.email;

  return new;
end;
$$;

revoke all on function public.sync_profile_email_from_auth()
from public, anon, authenticated;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email_from_auth();

-- Repair profiles created before this trigger existed. This intentionally
-- produces profile audit rows; the actor can be null because the migration is
-- a system operation rather than a signed-in user action.
update public.profiles as profile
set email = auth_user.email
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.email is distinct from auth_user.email;

comment on function public.sync_profile_email_from_auth() is
  'Trigger-only helper that mirrors auth.users.email into display-only profiles.email.';
