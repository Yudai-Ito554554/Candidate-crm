create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete restrict,
  from_status text
    check (from_status is null or from_status in (
      'considering', 'intention_confirming', 'proposed', 'applied',
      'document_screening', 'first_interview', 'second_interview',
      'final_interview', 'offer', 'accepted', 'joined', 'withdrawn', 'rejected'
    )),
  to_status text not null
    check (to_status in (
      'considering', 'intention_confirming', 'proposed', 'applied',
      'document_screening', 'first_interview', 'second_interview',
      'final_interview', 'offer', 'accepted', 'joined', 'withdrawn', 'rejected'
    )),
  changed_by uuid references auth.users(id) on delete set null,
  is_backfilled boolean not null default false,
  changed_at timestamptz not null default now()
);

create index application_status_history_application_changed_idx
on public.application_status_history (application_id, changed_at desc);

create index application_status_history_status_changed_idx
on public.application_status_history (to_status, changed_at desc);

insert into public.application_status_history (
  application_id,
  from_status,
  to_status,
  changed_by,
  is_backfilled,
  changed_at
)
select
  id,
  null,
  application_status,
  owner_id,
  true,
  created_at
from public.applications;

create function public.record_application_status_history()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (
      application_id,
      from_status,
      to_status,
      changed_by,
      changed_at
    ) values (
      new.id,
      null,
      new.application_status,
      coalesce((select auth.uid()), new.owner_id),
      new.created_at
    );
  elsif new.application_status is distinct from old.application_status then
    insert into public.application_status_history (
      application_id,
      from_status,
      to_status,
      changed_by,
      changed_at
    ) values (
      new.id,
      old.application_status,
      new.application_status,
      coalesce((select auth.uid()), new.owner_id),
      now()
    );
  end if;

  return new;
end;
$$;

create trigger applications_record_status_history
after insert or update of application_status on public.applications
for each row execute function public.record_application_status_history();

revoke execute on function public.record_application_status_history()
from public, anon, authenticated;

alter table public.application_status_history enable row level security;

create policy "authenticated users can read application status history"
on public.application_status_history for select to authenticated using (true);

revoke all on table public.application_status_history from anon;
revoke insert, update, delete, truncate
on table public.application_status_history from authenticated;
grant select on table public.application_status_history to authenticated;
