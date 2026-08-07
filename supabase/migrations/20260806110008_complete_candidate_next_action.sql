-- Complete a candidate's current next action and preserve it in the timeline.

create or replace function public.complete_candidate_next_action(
  target_candidate_id uuid
)
returns public.candidates
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_action text;
  current_due_at timestamptz;
  completed_candidate public.candidates;
begin
  if public.current_profile_role() not in ('admin', 'agent') then
    raise exception 'editor role required' using errcode = '42501';
  end if;

  select next_action, next_action_due_at
  into current_action, current_due_at
  from public.candidates
  where id = target_candidate_id
    and archived_at is null
  for update;

  if current_action is null or btrim(current_action) = '' then
    raise exception 'active next action not found' using errcode = 'P0002';
  end if;

  insert into public.activities (
    owner_id,
    candidate_id,
    activity_type,
    occurred_at,
    title,
    body,
    direction,
    metadata
  )
  values (
    (select auth.uid()),
    target_candidate_id,
    'task',
    now(),
    '次回対応を完了',
    current_action,
    'internal',
    jsonb_strip_nulls(jsonb_build_object('due_at', current_due_at))
  );

  update public.candidates
  set
    next_action = null,
    next_action_due_at = null,
    waiting_on = 'none'
  where id = target_candidate_id
  returning * into completed_candidate;

  return completed_candidate;
end;
$$;

revoke all on function public.complete_candidate_next_action(uuid)
from public, anon;
grant execute on function public.complete_candidate_next_action(uuid)
to authenticated;

comment on function public.complete_candidate_next_action(uuid) is
  'Editor-only atomic completion of a candidate next action with a timeline activity.';
