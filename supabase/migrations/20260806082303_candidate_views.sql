create table public.candidate_views (
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (user_id, candidate_id)
);

create index candidate_views_user_viewed_idx
on public.candidate_views (user_id, viewed_at desc);

alter table public.candidate_views enable row level security;

create policy "users can read their own candidate views"
on public.candidate_views for select to authenticated
using ((select auth.uid()) = user_id);

create function public.record_candidate_view(target_candidate_id uuid)
returns setof public.candidate_views
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_user_id uuid := (select auth.uid());
  recorded_view public.candidate_views;
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'authentication required';
  end if;

  insert into public.candidate_views (user_id, candidate_id, viewed_at)
  values (current_user_id, target_candidate_id, now())
  on conflict (user_id, candidate_id)
  do update set viewed_at = excluded.viewed_at
  returning * into recorded_view;

  return next recorded_view;
  return;
end;
$$;

revoke all on table public.candidate_views from anon;
revoke insert, update, delete, truncate
on table public.candidate_views from authenticated;
grant select on table public.candidate_views to authenticated;

revoke all on function public.record_candidate_view(uuid) from public, anon;
grant execute on function public.record_candidate_view(uuid) to authenticated;
