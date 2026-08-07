create extension if not exists pgcrypto;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  role text not null default 'agent'
    check (role in ('admin', 'agent', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  full_name_kana text,
  email text,
  phone text,
  birth_date date,
  prefecture text,
  current_company text,
  current_department text,
  current_job_title text,
  current_occupation text,
  candidate_status text not null default 'new'
    check (candidate_status in (
      'new', 'contacted', 'interview_scheduling', 'interviewed',
      'job_proposed', 'intention_confirming', 'active_selection',
      'offered', 'joined', 'on_hold', 'closed'
    )),
  desired_occupations text[] not null default '{}',
  desired_locations text[] not null default '{}',
  current_salary_min integer check (current_salary_min is null or current_salary_min >= 0),
  current_salary_max integer check (current_salary_max is null or current_salary_max >= 0),
  desired_salary_min integer check (desired_salary_min is null or desired_salary_min >= 0),
  desired_salary_max integer check (desired_salary_max is null or desired_salary_max >= 0),
  available_from date,
  reason_for_change text,
  priority_conditions text,
  strengths text,
  concerns text,
  interview_summary text,
  next_action text,
  next_action_due_at timestamptz,
  waiting_on text not null default 'none'
    check (waiting_on in ('self', 'candidate', 'company', 'none')),
  last_contacted_at timestamptz,
  source text,
  private_notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidates_current_salary_range_check check (
    current_salary_min is null or current_salary_max is null
    or current_salary_min <= current_salary_max
  ),
  constraint candidates_desired_salary_range_check check (
    desired_salary_min is null or desired_salary_max is null
    or desired_salary_min <= desired_salary_max
  )
);

create table public.candidate_experiences (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  company_name text,
  department text,
  job_title text,
  occupation text,
  started_on date,
  ended_on date,
  is_current boolean not null default false,
  experience_domain text,
  responsibilities text,
  achievements text,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint candidate_experiences_date_range_check check (
    started_on is null or ended_on is null or ended_on >= started_on
  )
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  name_kana text,
  industry text,
  employees integer check (employees is null or employees >= 0),
  capital bigint check (capital is null or capital >= 0),
  listed boolean,
  website text,
  address text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  department text,
  position text,
  email text,
  phone text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  contact_id uuid references public.company_contacts(id),
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  division text,
  occupation text,
  employment_type text,
  locations text[] not null default '{}',
  salary_min integer check (salary_min is null or salary_min >= 0),
  salary_max integer check (salary_max is null or salary_max >= 0),
  job_status text not null default 'draft'
    check (job_status in ('draft', 'open', 'paused', 'closed')),
  required_conditions text,
  preferred_conditions text,
  description text,
  internal_notes text,
  opened_at date,
  closed_at date,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_salary_range_check check (
    salary_min is null or salary_max is null or salary_min <= salary_max
  ),
  constraint jobs_open_period_check check (
    opened_at is null or closed_at is null or closed_at >= opened_at
  )
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id),
  job_id uuid not null references public.jobs(id),
  owner_id uuid references auth.users(id) on delete set null,
  application_status text not null default 'considering'
    check (application_status in (
      'considering', 'intention_confirming', 'proposed', 'applied',
      'document_screening', 'first_interview', 'second_interview',
      'final_interview', 'offer', 'accepted', 'joined', 'withdrawn', 'rejected'
    )),
  proposed_at timestamptz,
  applied_at timestamptz,
  next_event text,
  next_event_at timestamptz,
  rejection_reason text,
  withdrawal_reason text,
  offered_salary integer check (offered_salary is null or offered_salary >= 0),
  joined_on date,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  candidate_id uuid references public.candidates(id),
  company_id uuid references public.companies(id),
  job_id uuid references public.jobs(id),
  application_id uuid references public.applications(id),
  activity_type text not null
    check (activity_type in (
      'interview', 'phone', 'email_sent', 'email_received', 'job_proposed',
      'intention_confirmed', 'application', 'document_submitted',
      'company_contact', 'interview_scheduled', 'meeting', 'selection_result',
      'task', 'note'
    )),
  occurred_at timestamptz not null,
  title text not null,
  body text,
  direction text not null default 'none'
    check (direction in ('inbound', 'outbound', 'internal', 'none')),
  external_message_id text,
  ai_generated boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  candidate_id uuid references public.candidates(id),
  company_id uuid references public.companies(id),
  job_id uuid references public.jobs(id),
  application_id uuid references public.applications(id),
  task_type text not null
    check (task_type in (
      'follow_up', 'call', 'email', 'meeting', 'proposal', 'selection', 'internal'
    )),
  title text not null,
  description text,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at timestamptz,
  completed_at timestamptz,
  waiting_on text not null default 'none'
    check (waiting_on in ('self', 'candidate', 'company', 'none')),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_completed_after_created_check check (
    completed_at is null or completed_at >= created_at
  )
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  candidate_id uuid references public.candidates(id),
  company_id uuid references public.companies(id),
  job_id uuid references public.jobs(id),
  application_id uuid references public.applications(id),
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint check (file_size is null or file_size >= 0),
  category text not null default 'other'
    check (category in (
      'resume', 'career_history', 'job_description',
      'application_document', 'certificate', 'other'
    )),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint files_related_entity_check check (
    num_nonnulls(candidate_id, company_id, job_id, application_id) > 0
  )
);

create table public.email_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  candidate_id uuid references public.candidates(id),
  company_id uuid references public.companies(id),
  job_id uuid references public.jobs(id),
  application_id uuid references public.applications(id),
  provider text not null default 'manual'
    check (provider in ('manual', 'gmail', 'outlook')),
  external_thread_id text,
  subject text not null,
  participant_type text not null default 'other'
    check (participant_type in ('candidate', 'company', 'other')),
  status text not null default 'unhandled'
    check (status in ('unhandled', 'waiting_reply', 'handled')),
  has_ai_draft boolean not null default false,
  last_sender_name text,
  last_message_preview text,
  last_message_at timestamptz not null default now(),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.email_threads(id) on delete cascade,
  activity_id uuid references public.activities(id) on delete set null,
  external_message_id text,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_name text,
  sender_email text not null,
  recipient_emails text[] not null default '{}',
  cc_emails text[] not null default '{}',
  body_text text not null,
  sent_at timestamptz not null,
  has_attachments boolean not null default false,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.refresh_email_thread_from_message()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.email_threads
  set
    last_sender_name = coalesce(new.sender_name, new.sender_email),
    last_message_preview = left(regexp_replace(new.body_text, '\\s+', ' ', 'g'), 160),
    last_message_at = new.sent_at
  where id = new.thread_id
    and new.sent_at >= last_message_at;
  return new;
end;
$$;

create trigger email_messages_refresh_thread
after insert on public.email_messages
for each row execute function public.refresh_email_thread_from_message();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_tags (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.company_tags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.job_tags (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.validate_application_relation()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  related_candidate_id uuid;
  related_job_id uuid;
begin
  if new.application_id is null then
    return new;
  end if;

  select candidate_id, job_id
  into related_candidate_id, related_job_id
  from public.applications
  where id = new.application_id;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'application_id does not reference an existing application';
  end if;

  if new.candidate_id is not null and new.candidate_id <> related_candidate_id then
    raise exception using
      errcode = '23514',
      message = 'candidate_id does not match application candidate';
  end if;

  if new.job_id is not null and new.job_id <> related_job_id then
    raise exception using
      errcode = '23514',
      message = 'job_id does not match application job';
  end if;

  new.candidate_id := coalesce(new.candidate_id, related_candidate_id);
  new.job_id := coalesce(new.job_id, related_job_id);
  return new;
end;
$$;

create trigger activities_validate_application_relation
before insert or update of application_id, candidate_id, job_id on public.activities
for each row execute function public.validate_application_relation();

create trigger tasks_validate_application_relation
before insert or update of application_id, candidate_id, job_id on public.tasks
for each row execute function public.validate_application_relation();

create trigger files_validate_application_relation
before insert or update of application_id, candidate_id, job_id on public.files
for each row execute function public.validate_application_relation();

create trigger email_threads_validate_application_relation
before insert or update of application_id, candidate_id, job_id on public.email_threads
for each row execute function public.validate_application_relation();

create function public.prevent_referenced_application_identity_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.candidate_id is not distinct from old.candidate_id
    and new.job_id is not distinct from old.job_id then
    return new;
  end if;

  if exists (select 1 from public.activities where application_id = old.id)
    or exists (select 1 from public.tasks where application_id = old.id)
    or exists (select 1 from public.files where application_id = old.id)
    or exists (select 1 from public.email_threads where application_id = old.id) then
    raise exception using
      errcode = '23514',
      message = 'cannot change candidate_id or job_id of a referenced application';
  end if;

  return new;
end;
$$;

create trigger applications_prevent_referenced_identity_change
before update of candidate_id, job_id on public.applications
for each row execute function public.prevent_referenced_application_identity_change();

create function public.validate_job_contact_company()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.contact_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.company_contacts
    where id = new.contact_id
      and company_id = new.company_id
      and archived_at is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'job contact must belong to the selected company';
  end if;

  return new;
end;
$$;

create trigger jobs_validate_contact_company
before insert or update of company_id, contact_id on public.jobs
for each row execute function public.validate_job_contact_company();

create function public.prevent_archiving_referenced_records()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.archived_at is null or old.archived_at is not null then
    return new;
  end if;

  if tg_table_name = 'companies' and exists (
    select 1 from public.jobs
    where company_id = old.id and archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'cannot archive company with active jobs';
  end if;

  if tg_table_name = 'company_contacts' and exists (
    select 1 from public.jobs
    where contact_id = old.id and archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'cannot archive contact referenced by an active job';
  end if;

  if tg_table_name = 'jobs' and exists (
    select 1 from public.applications
    where job_id = old.id and archived_at is null
  ) then
    raise exception using errcode = '23514', message = 'cannot archive job with applications';
  end if;

  return new;
end;
$$;

create trigger companies_prevent_referenced_archive
before update of archived_at on public.companies
for each row execute function public.prevent_archiving_referenced_records();
create trigger company_contacts_prevent_referenced_archive
before update of archived_at on public.company_contacts
for each row execute function public.prevent_archiving_referenced_records();
create trigger jobs_prevent_referenced_archive
before update of archived_at on public.jobs
for each row execute function public.prevent_archiving_referenced_records();

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger candidates_set_updated_at before update on public.candidates
for each row execute function public.set_updated_at();
create trigger candidate_experiences_set_updated_at before update on public.candidate_experiences
for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies
for each row execute function public.set_updated_at();
create trigger company_contacts_set_updated_at before update on public.company_contacts
for each row execute function public.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
for each row execute function public.set_updated_at();
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();
create trigger activities_set_updated_at before update on public.activities
for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
create trigger files_set_updated_at before update on public.files
for each row execute function public.set_updated_at();
create trigger email_threads_set_updated_at before update on public.email_threads
for each row execute function public.set_updated_at();
create trigger email_messages_set_updated_at before update on public.email_messages
for each row execute function public.set_updated_at();
create trigger tags_set_updated_at before update on public.tags
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    new.email
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name, email)
select
  id,
  nullif(trim(coalesce(raw_user_meta_data ->> 'display_name', '')), ''),
  email
from auth.users
on conflict (id) do nothing;

create index candidates_full_name_idx on public.candidates (full_name)
where archived_at is null;
create index candidates_status_idx on public.candidates (candidate_status)
where archived_at is null;
create index candidates_owner_idx on public.candidates (owner_id)
where archived_at is null;
create index candidates_next_action_due_idx on public.candidates (next_action_due_at)
where archived_at is null;
create index candidates_last_contacted_idx on public.candidates (last_contacted_at desc)
where archived_at is null;
create index candidate_experiences_candidate_sort_idx
on public.candidate_experiences (candidate_id, sort_order)
where archived_at is null;
create index companies_name_idx on public.companies (name)
where archived_at is null;
create index company_contacts_company_idx on public.company_contacts (company_id)
where archived_at is null;
create index jobs_company_idx on public.jobs (company_id)
where archived_at is null;
create index jobs_status_idx on public.jobs (job_status)
where archived_at is null;
create index applications_candidate_idx on public.applications (candidate_id)
where archived_at is null;
create index applications_job_idx on public.applications (job_id)
where archived_at is null;
create index applications_status_idx on public.applications (application_status)
where archived_at is null;
create unique index applications_one_active_candidate_job_idx
on public.applications (candidate_id, job_id)
where archived_at is null
  and application_status not in ('joined', 'withdrawn', 'rejected');
create index activities_candidate_occurred_idx
on public.activities (candidate_id, occurred_at desc)
where archived_at is null;
create index activities_company_occurred_idx
on public.activities (company_id, occurred_at desc);
create index tasks_owner_due_idx on public.tasks (owner_id, due_at)
where archived_at is null;
create index tasks_candidate_due_idx on public.tasks (candidate_id, due_at)
where archived_at is null;
create index files_candidate_created_idx on public.files (candidate_id, created_at desc)
where archived_at is null;
create index files_job_created_idx on public.files (job_id, created_at desc)
where archived_at is null;
create unique index files_storage_path_idx on public.files (storage_path);
create index email_threads_status_last_message_idx
on public.email_threads (status, last_message_at desc)
where archived_at is null;
create index email_threads_candidate_idx
on public.email_threads (candidate_id, last_message_at desc)
where archived_at is null;
create index email_threads_company_idx
on public.email_threads (company_id, last_message_at desc)
where archived_at is null;
create unique index email_threads_external_idx
on public.email_threads (provider, external_thread_id)
where external_thread_id is not null;
create index email_messages_thread_sent_idx
on public.email_messages (thread_id, sent_at);
create unique index email_messages_external_idx
on public.email_messages (external_message_id)
where external_message_id is not null;
create unique index tags_active_name_idx on public.tags (lower(name))
where archived_at is null;
create unique index candidate_tags_active_relation_idx
on public.candidate_tags (candidate_id, tag_id) where archived_at is null;
create index candidate_tags_tag_idx on public.candidate_tags (tag_id)
where archived_at is null;
create unique index company_tags_active_relation_idx
on public.company_tags (company_id, tag_id) where archived_at is null;
create index company_tags_tag_idx on public.company_tags (tag_id)
where archived_at is null;
create unique index job_tags_active_relation_idx
on public.job_tags (job_id, tag_id) where archived_at is null;
create index job_tags_tag_idx on public.job_tags (tag_id)
where archived_at is null;

alter table public.profiles enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_experiences enable row level security;
alter table public.companies enable row level security;
alter table public.company_contacts enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.activities enable row level security;
alter table public.tasks enable row level security;
alter table public.files enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;
alter table public.tags enable row level security;
alter table public.candidate_tags enable row level security;
alter table public.company_tags enable row level security;
alter table public.job_tags enable row level security;

create policy "authenticated users can read profiles"
on public.profiles for select to authenticated using (true);
create policy "users can update their own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "authenticated users can read candidates"
on public.candidates for select to authenticated using (true);
create policy "authenticated users can insert candidates"
on public.candidates for insert to authenticated with check (true);
create policy "authenticated users can update candidates"
on public.candidates for update to authenticated using (true) with check (true);

create policy "authenticated users can read candidate experiences"
on public.candidate_experiences for select to authenticated using (true);
create policy "authenticated users can insert candidate experiences"
on public.candidate_experiences for insert to authenticated with check (true);
create policy "authenticated users can update candidate experiences"
on public.candidate_experiences for update to authenticated using (true) with check (true);

create policy "authenticated users can read companies"
on public.companies for select to authenticated using (true);
create policy "authenticated users can insert companies"
on public.companies for insert to authenticated with check (true);
create policy "authenticated users can update companies"
on public.companies for update to authenticated using (true) with check (true);

create policy "authenticated users can read company contacts"
on public.company_contacts for select to authenticated using (true);
create policy "authenticated users can insert company contacts"
on public.company_contacts for insert to authenticated with check (true);
create policy "authenticated users can update company contacts"
on public.company_contacts for update to authenticated using (true) with check (true);

create policy "authenticated users can read jobs"
on public.jobs for select to authenticated using (true);
create policy "authenticated users can insert jobs"
on public.jobs for insert to authenticated with check (true);
create policy "authenticated users can update jobs"
on public.jobs for update to authenticated using (true) with check (true);

create policy "authenticated users can read applications"
on public.applications for select to authenticated using (true);
create policy "authenticated users can insert applications"
on public.applications for insert to authenticated with check (true);
create policy "authenticated users can update applications"
on public.applications for update to authenticated using (true) with check (true);

create policy "authenticated users can read activities"
on public.activities for select to authenticated using (true);
create policy "authenticated users can insert activities"
on public.activities for insert to authenticated with check (true);
create policy "authenticated users can update activities"
on public.activities for update to authenticated using (true) with check (true);

create policy "authenticated users can read tasks"
on public.tasks for select to authenticated using (true);
create policy "authenticated users can insert tasks"
on public.tasks for insert to authenticated with check (true);
create policy "authenticated users can update tasks"
on public.tasks for update to authenticated using (true) with check (true);

create policy "authenticated users can read files"
on public.files for select to authenticated using (true);
create policy "authenticated users can insert files"
on public.files for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "authenticated users can update files"
on public.files for update to authenticated using (true) with check (true);

create policy "authenticated users can read email threads"
on public.email_threads for select to authenticated using (true);
create policy "authenticated users can update email thread workflow"
on public.email_threads for update to authenticated using (true) with check (true);

create policy "authenticated users can read email messages"
on public.email_messages for select to authenticated using (true);

create policy "authenticated users can read tags"
on public.tags for select to authenticated using (true);
create policy "authenticated users can insert tags"
on public.tags for insert to authenticated with check (true);
create policy "authenticated users can update tags"
on public.tags for update to authenticated using (true) with check (true);

create policy "authenticated users can read candidate tags"
on public.candidate_tags for select to authenticated using (true);
create policy "authenticated users can insert candidate tags"
on public.candidate_tags for insert to authenticated with check (true);
create policy "authenticated users can update candidate tags"
on public.candidate_tags for update to authenticated using (true) with check (true);

create policy "authenticated users can read company tags"
on public.company_tags for select to authenticated using (true);
create policy "authenticated users can insert company tags"
on public.company_tags for insert to authenticated with check (true);
create policy "authenticated users can update company tags"
on public.company_tags for update to authenticated using (true) with check (true);

create policy "authenticated users can read job tags"
on public.job_tags for select to authenticated using (true);
create policy "authenticated users can insert job tags"
on public.job_tags for insert to authenticated with check (true);
create policy "authenticated users can update job tags"
on public.job_tags for update to authenticated using (true) with check (true);

revoke all on table public.profiles from anon;
revoke all on table public.candidates from anon;
revoke all on table public.candidate_experiences from anon;
revoke all on table public.companies from anon;
revoke all on table public.company_contacts from anon;
revoke all on table public.jobs from anon;
revoke all on table public.applications from anon;
revoke all on table public.activities from anon;
revoke all on table public.tasks from anon;
revoke all on table public.files from anon;
revoke all on table public.email_threads from anon;
revoke all on table public.email_messages from anon;
revoke all on table public.tags from anon;
revoke all on table public.candidate_tags from anon;
revoke all on table public.company_tags from anon;
revoke all on table public.job_tags from anon;

revoke insert, delete, truncate on table public.profiles from authenticated;
revoke update on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select, insert, update on table public.candidates to authenticated;
grant select, insert, update on table public.candidate_experiences to authenticated;
grant select, insert, update on table public.companies to authenticated;
grant select, insert, update on table public.company_contacts to authenticated;
grant select, insert, update on table public.jobs to authenticated;
grant select, insert, update on table public.applications to authenticated;
grant select, insert, update on table public.activities to authenticated;
grant select, insert, update on table public.tasks to authenticated;
grant select, insert on table public.files to authenticated;
grant update (archived_at) on table public.files to authenticated;
grant select on table public.email_threads to authenticated;
grant update (status, archived_at) on table public.email_threads to authenticated;
grant select on table public.email_messages to authenticated;
grant select, insert, update on table public.tags to authenticated;
grant select, insert, update on table public.candidate_tags to authenticated;
grant select, insert, update on table public.company_tags to authenticated;
grant select, insert, update on table public.job_tags to authenticated;

revoke delete, truncate on table public.candidates from authenticated;
revoke delete, truncate on table public.candidate_experiences from authenticated;
revoke delete, truncate on table public.companies from authenticated;
revoke delete, truncate on table public.company_contacts from authenticated;
revoke delete, truncate on table public.jobs from authenticated;
revoke delete, truncate on table public.applications from authenticated;
revoke delete, truncate on table public.activities from authenticated;
revoke delete, truncate on table public.tasks from authenticated;
revoke delete, truncate on table public.files from authenticated;
revoke insert, delete, truncate on table public.email_threads from authenticated;
revoke insert, update, delete, truncate on table public.email_messages from authenticated;
revoke delete, truncate on table public.tags from authenticated;
revoke delete, truncate on table public.candidate_tags from authenticated;
revoke delete, truncate on table public.company_tags from authenticated;
revoke delete, truncate on table public.job_tags from authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'crm-files',
  'crm-files',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated users can read crm files"
on storage.objects for select to authenticated
using (bucket_id = 'crm-files');

create policy "authenticated users can upload crm files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'crm-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- DELETE is limited to an uploader's own folder and is used only to compensate
-- for a metadata insert failure. The application archives completed uploads.
create policy "users can clean up their failed crm uploads"
on storage.objects for delete to authenticated
using (
  bucket_id = 'crm-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
