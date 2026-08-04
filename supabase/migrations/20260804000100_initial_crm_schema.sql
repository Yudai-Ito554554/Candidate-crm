create extension if not exists pgcrypto;

create type public.member_role as enum ('owner', 'admin', 'agent', 'viewer');
create type public.candidate_status as enum (
  'new', 'first_contact', 'interview_scheduling', 'interviewed',
  'job_proposed', 'application_confirming', 'in_selection', 'offered',
  'joined', 'on_hold'
);
create type public.job_status as enum ('open', 'paused', 'filled');
create type public.application_status as enum (
  'considering', 'confirming_intent', 'applied', 'document_screening',
  'first_interview', 'second_interview', 'final_interview', 'offer',
  'accepted', 'joined', 'withdrawn', 'rejected'
);
create type public.task_priority as enum ('high', 'medium', 'low');
create type public.task_type as enum (
  'candidate_contact', 'company_followup', 'interview', 'document',
  'selection_followup', 'other'
);
create type public.task_status as enum ('not_started', 'in_progress', 'completed');
create type public.timeline_category as enum (
  'email', 'meeting_call', 'job_selection', 'task_note'
);
create type public.timeline_event_type as enum (
  'zoom_meeting', 'phone', 'email_sent', 'email_received', 'job_proposed',
  'application_intent', 'application', 'document_submitted', 'interview',
  'company_followup', 'selection_result', 'task_created', 'note'
);
create type public.inbox_source_type as enum ('candidate', 'company', 'other');
create type public.response_status as enum ('unhandled', 'waiting', 'completed');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.member_role not null default 'agent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  industry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  birth_date date,
  phone text,
  email text,
  location text,
  current_company text,
  department text,
  current_role text,
  employment_period text,
  experience_area text,
  experience_years integer check (experience_years is null or experience_years >= 0),
  desired_role text,
  desired_location text,
  desired_salary integer check (desired_salary is null or desired_salary >= 0),
  available_from text,
  reason_for_change text,
  priorities text[] not null default '{}',
  status public.candidate_status not null default 'new',
  last_contact_date date,
  next_contact_date date,
  next_action text,
  owner_id uuid,
  strengths text,
  concerns text,
  interview_notes text,
  recently_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  foreign key (organization_id, owner_id)
    references public.organization_members(organization_id, user_id)
    on delete set null (owner_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  division text,
  title text not null,
  role text not null,
  location text not null,
  salary_min integer check (salary_min is null or salary_min >= 0),
  salary_max integer check (salary_max is null or salary_max >= 0),
  status public.job_status not null default 'open',
  hiring_manager text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (salary_min is null or salary_max is null or salary_min <= salary_max),
  unique (id, organization_id),
  foreign key (company_id, organization_id)
    references public.companies(id, organization_id)
    on delete restrict
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null,
  job_id uuid not null,
  status public.application_status not null default 'considering',
  proposed_at date,
  applied_at date,
  next_step text,
  next_step_date date,
  decline_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, job_id),
  foreign key (candidate_id, organization_id)
    references public.candidates(id, organization_id)
    on delete cascade,
  foreign key (job_id, organization_id)
    references public.jobs(id, organization_id)
    on delete cascade
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  due_at timestamptz not null,
  priority public.task_priority not null default 'medium',
  task_type public.task_type not null default 'other',
  status public.task_status not null default 'not_started',
  candidate_id uuid,
  job_id uuid,
  assignee_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id)
    references public.candidates(id, organization_id)
    on delete cascade,
  foreign key (job_id, organization_id)
    references public.jobs(id, organization_id)
    on delete cascade,
  foreign key (organization_id, assignee_id)
    references public.organization_members(organization_id, user_id)
    on delete set null (assignee_id)
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null,
  job_id uuid,
  occurred_at timestamptz not null default now(),
  event_type public.timeline_event_type not null,
  category public.timeline_category not null,
  title text not null,
  content text not null default '',
  actor_id uuid,
  has_attachment boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id)
    references public.candidates(id, organization_id)
    on delete cascade,
  foreign key (job_id, organization_id)
    references public.jobs(id, organization_id)
    on delete set null (job_id),
  foreign key (organization_id, actor_id)
    references public.organization_members(organization_id, user_id)
    on delete set null (actor_id)
);

create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid,
  job_id uuid,
  sender text not null,
  sender_email text,
  subject text not null,
  preview text not null default '',
  body text not null default '',
  received_at timestamptz not null,
  source_type public.inbox_source_type not null default 'other',
  response_status public.response_status not null default 'unhandled',
  has_ai_draft boolean not null default false,
  external_message_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id)
    references public.candidates(id, organization_id)
    on delete set null (candidate_id),
  foreign key (job_id, organization_id)
    references public.jobs(id, organization_id)
    on delete set null (job_id)
);

create unique index inbox_messages_external_id_idx
  on public.inbox_messages (organization_id, external_message_id)
  where external_message_id is not null;

create table public.candidate_ai_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  candidate_id uuid not null,
  summary text,
  motivation text,
  strengths text,
  concerns text,
  interview_questions text[] not null default '{}',
  recommended_job_ids uuid[] not null default '{}',
  next_action text,
  email_draft text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id),
  foreign key (candidate_id, organization_id)
    references public.candidates(id, organization_id)
    on delete cascade
);

create index candidates_organization_status_idx
  on public.candidates (organization_id, status);
create index candidates_next_contact_idx
  on public.candidates (organization_id, next_contact_date);
create index jobs_organization_status_idx
  on public.jobs (organization_id, status);
create index applications_candidate_idx on public.applications (candidate_id, status);
create index applications_job_idx on public.applications (job_id, status);
create index tasks_due_idx on public.tasks (organization_id, due_at, status);
create index timeline_candidate_occurred_idx
  on public.timeline_events (candidate_id, occurred_at desc);
create index inbox_received_idx
  on public.inbox_messages (organization_id, received_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'organizations', 'profiles', 'organization_members', 'companies',
    'candidates', 'jobs', 'applications', 'tasks', 'timeline_events',
    'inbox_messages', 'candidate_ai_analyses'
  ] loop
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'ユーザー'),
    coalesce(new.email, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = target_organization_id
      and user_id = (select auth.uid())
      and role = any(allowed_roles)
  );
$$;

create or replace function public.create_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(organization_name)) not between 1 and 120 then
    raise exception 'Organization name must be between 1 and 120 characters';
  end if;

  insert into public.organizations (name)
  values (trim(organization_name))
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, (select auth.uid()), 'owner');

  return new_organization_id;
end;
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.candidates enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.tasks enable row level security;
alter table public.timeline_events enable row level security;
alter table public.inbox_messages enable row level security;
alter table public.candidate_ai_analyses enable row level security;

create policy "members can read organizations"
  on public.organizations for select to authenticated
  using ((select public.is_organization_member(id)));
create policy "admins can update organizations"
  on public.organizations for update to authenticated
  using ((select public.has_organization_role(id, array['owner', 'admin']::public.member_role[])))
  with check ((select public.has_organization_role(id, array['owner', 'admin']::public.member_role[])));

create policy "users can read shared profiles"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members viewer
      join public.organization_members target
        on target.organization_id = viewer.organization_id
      where viewer.user_id = (select auth.uid())
        and target.user_id = profiles.id
    )
  );
create policy "users can update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "members can read organization memberships"
  on public.organization_members for select to authenticated
  using ((select public.is_organization_member(organization_id)));
create policy "admins can add organization memberships"
  on public.organization_members for insert to authenticated
  with check ((select public.has_organization_role(organization_id, array['owner', 'admin']::public.member_role[])));
create policy "admins can update organization memberships"
  on public.organization_members for update to authenticated
  using ((select public.has_organization_role(organization_id, array['owner', 'admin']::public.member_role[])))
  with check ((select public.has_organization_role(organization_id, array['owner', 'admin']::public.member_role[])));
create policy "admins can remove organization memberships"
  on public.organization_members for delete to authenticated
  using ((select public.has_organization_role(organization_id, array['owner', 'admin']::public.member_role[])));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies', 'candidates', 'jobs', 'applications', 'tasks',
    'timeline_events', 'inbox_messages', 'candidate_ai_analyses'
  ] loop
    execute format(
      'create policy "members can read %1$s" on public.%1$I for select to authenticated using ((select public.is_organization_member(organization_id)))',
      table_name
    );
    execute format(
      'create policy "writers can insert %1$s" on public.%1$I for insert to authenticated with check ((select public.has_organization_role(organization_id, array[''owner'', ''admin'', ''agent'']::public.member_role[])))',
      table_name
    );
    execute format(
      'create policy "writers can update %1$s" on public.%1$I for update to authenticated using ((select public.has_organization_role(organization_id, array[''owner'', ''admin'', ''agent'']::public.member_role[]))) with check ((select public.has_organization_role(organization_id, array[''owner'', ''admin'', ''agent'']::public.member_role[])))',
      table_name
    );
    execute format(
      'create policy "admins can delete %1$s" on public.%1$I for delete to authenticated using ((select public.has_organization_role(organization_id, array[''owner'', ''admin'']::public.member_role[])))',
      table_name
    );
  end loop;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.handle_new_user() from public;
revoke all on function public.create_organization(text) from public;
revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.has_organization_role(uuid, public.member_role[]) from public;
grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, public.member_role[]) to authenticated;

grant usage on schema public to authenticated;
grant select on public.organizations, public.profiles, public.organization_members to authenticated;
grant select, insert, update, delete on
  public.companies,
  public.candidates,
  public.jobs,
  public.applications,
  public.tasks,
  public.timeline_events,
  public.inbox_messages,
  public.candidate_ai_analyses
to authenticated;
