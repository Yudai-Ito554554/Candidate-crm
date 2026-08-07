-- Phase 3V: RLS-aware global search for candidates, companies, and jobs.

create extension if not exists pg_trgm with schema extensions;

-- PostgreSQL marks array_to_string as STABLE, so it cannot be used directly in
-- an expression index. This wrapper is immutable for text-array inputs and keeps
-- the indexed expression identical to the search function's expression.
create or replace function public.immutable_text_array_to_string(
  input_values text[],
  delimiter text
)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select pg_catalog.array_to_string(input_values, delimiter);
$$;

revoke all on function public.immutable_text_array_to_string(text[], text) from public, anon;
grant execute on function public.immutable_text_array_to_string(text[], text) to authenticated, service_role;

create index candidates_global_search_trgm_idx
on public.candidates using gin (
  (
    lower(
      coalesce(full_name, '') || ' ' ||
      coalesce(full_name_kana, '') || ' ' ||
      coalesce(current_company, '') || ' ' ||
      coalesce(current_department, '') || ' ' ||
      coalesce(current_job_title, '') || ' ' ||
      coalesce(current_occupation, '') || ' ' ||
      coalesce(prefecture, '') || ' ' ||
      coalesce(public.immutable_text_array_to_string(desired_occupations, ' '), '') || ' ' ||
      coalesce(public.immutable_text_array_to_string(desired_locations, ' '), '')
    )
  ) extensions.gin_trgm_ops
)
where archived_at is null;

create index companies_global_search_trgm_idx
on public.companies using gin (
  (
    lower(
      coalesce(name, '') || ' ' ||
      coalesce(name_kana, '') || ' ' ||
      coalesce(industry, '') || ' ' ||
      coalesce(address, '')
    )
  ) extensions.gin_trgm_ops
)
where archived_at is null;

create index jobs_global_search_trgm_idx
on public.jobs using gin (
  (
    lower(
      coalesce(title, '') || ' ' ||
      coalesce(division, '') || ' ' ||
      coalesce(occupation, '') || ' ' ||
      coalesce(public.immutable_text_array_to_string(locations, ' '), '') || ' ' ||
      coalesce(description, '')
    )
  ) extensions.gin_trgm_ops
)
where archived_at is null;

create index tags_global_search_trgm_idx
on public.tags using gin ((lower(name)) extensions.gin_trgm_ops)
where archived_at is null;

create or replace function public.search_crm(
  query_text text,
  result_limit integer default 12
)
returns table (
  entity_type text,
  entity_id uuid,
  primary_text text,
  secondary_text text,
  status_text text,
  updated_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with search_input as (
    select
      lower(btrim(query_text)) as term,
      '%' ||
        replace(
          replace(
            replace(lower(btrim(query_text)), E'\\', E'\\\\'),
            '%',
            E'\\%'
          ),
          '_',
          E'\\_'
        ) ||
      '%' as pattern,
      least(greatest(coalesce(result_limit, 12), 1), 30) as max_results
  ),
  candidate_sources as (
    select
      candidate.id,
      candidate.full_name,
      concat_ws(
        '・',
        nullif(candidate.current_company, ''),
        nullif(candidate.current_occupation, candidate.current_job_title),
        nullif(candidate.current_job_title, '')
      ) as secondary_text,
      candidate.candidate_status::text as status_text,
      candidate.updated_at,
      lower(
        coalesce(candidate.full_name, '') || ' ' ||
        coalesce(candidate.full_name_kana, '') || ' ' ||
        coalesce(candidate.current_company, '') || ' ' ||
        coalesce(candidate.current_department, '') || ' ' ||
        coalesce(candidate.current_job_title, '') || ' ' ||
        coalesce(candidate.current_occupation, '') || ' ' ||
        coalesce(candidate.prefecture, '') || ' ' ||
        coalesce(public.immutable_text_array_to_string(candidate.desired_occupations, ' '), '') || ' ' ||
        coalesce(public.immutable_text_array_to_string(candidate.desired_locations, ' '), '')
      ) as search_text
    from public.candidates as candidate
    where candidate.archived_at is null
  ),
  company_sources as (
    select
      company.id,
      company.name,
      concat_ws('・', nullif(company.industry, ''), nullif(company.address, '')) as secondary_text,
      case when company.listed then 'listed' else 'unlisted' end as status_text,
      company.updated_at,
      lower(
        coalesce(company.name, '') || ' ' ||
        coalesce(company.name_kana, '') || ' ' ||
        coalesce(company.industry, '') || ' ' ||
        coalesce(company.address, '')
      ) as search_text
    from public.companies as company
    where company.archived_at is null
  ),
  job_sources as (
    select
      job.id,
      job.title,
      company.name as company_name,
      concat_ws(
        '・',
        nullif(company.name, ''),
        nullif(job.division, ''),
        nullif(job.occupation, ''),
        nullif(public.immutable_text_array_to_string(job.locations, '・'), '')
      ) as secondary_text,
      job.job_status::text as status_text,
      job.updated_at,
      lower(
        coalesce(job.title, '') || ' ' ||
        coalesce(job.division, '') || ' ' ||
        coalesce(job.occupation, '') || ' ' ||
        coalesce(public.immutable_text_array_to_string(job.locations, ' '), '') || ' ' ||
        coalesce(job.description, '')
      ) as search_text
    from public.jobs as job
    join public.companies as company
      on company.id = job.company_id
      and company.archived_at is null
    where job.archived_at is null
  ),
  matches as (
    select
      'candidate'::text as entity_type,
      candidate.id as entity_id,
      candidate.full_name as primary_text,
      candidate.secondary_text,
      candidate.status_text,
      candidate.updated_at,
      greatest(
        similarity(candidate.search_text, search_input.term),
        case when lower(candidate.full_name) = search_input.term then 1.0 else 0.0 end,
        case when lower(candidate.full_name) like search_input.term || '%' then 0.9 else 0.0 end
      )::real as rank
    from candidate_sources as candidate
    cross join search_input
    where search_input.term <> ''
      and (
        candidate.search_text like search_input.pattern escape E'\\'
        or exists (
          select 1
          from public.candidate_tags as candidate_tag
          join public.tags as tag on tag.id = candidate_tag.tag_id
          where candidate_tag.candidate_id = candidate.id
            and candidate_tag.archived_at is null
            and tag.archived_at is null
            and lower(tag.name) like search_input.pattern escape E'\\'
        )
      )

    union all

    select
      'company'::text,
      company.id,
      company.name,
      company.secondary_text,
      company.status_text,
      company.updated_at,
      greatest(
        similarity(company.search_text, search_input.term),
        case when lower(company.name) = search_input.term then 1.0 else 0.0 end,
        case when lower(company.name) like search_input.term || '%' then 0.9 else 0.0 end
      )::real
    from company_sources as company
    cross join search_input
    where search_input.term <> ''
      and (
        company.search_text like search_input.pattern escape E'\\'
        or exists (
          select 1
          from public.company_tags as company_tag
          join public.tags as tag on tag.id = company_tag.tag_id
          where company_tag.company_id = company.id
            and company_tag.archived_at is null
            and tag.archived_at is null
            and lower(tag.name) like search_input.pattern escape E'\\'
        )
      )

    union all

    select
      'job'::text,
      job.id,
      job.title,
      job.secondary_text,
      job.status_text,
      job.updated_at,
      greatest(
        similarity(job.search_text, search_input.term),
        case when lower(job.title) = search_input.term then 1.0 else 0.0 end,
        case when lower(job.title) like search_input.term || '%' then 0.9 else 0.0 end
      )::real
    from job_sources as job
    cross join search_input
    where search_input.term <> ''
      and (
        job.search_text like search_input.pattern escape E'\\'
        or lower(job.company_name) like search_input.pattern escape E'\\'
        or exists (
          select 1
          from public.job_tags as job_tag
          join public.tags as tag on tag.id = job_tag.tag_id
          where job_tag.job_id = job.id
            and job_tag.archived_at is null
            and tag.archived_at is null
            and lower(tag.name) like search_input.pattern escape E'\\'
        )
      )
  )
  select
    matches.entity_type,
    matches.entity_id,
    matches.primary_text,
    nullif(matches.secondary_text, ''),
    matches.status_text,
    matches.updated_at,
    matches.rank
  from matches
  cross join search_input
  order by matches.rank desc, matches.updated_at desc
  limit (select max_results from search_input);
$$;

revoke all on function public.search_crm(text, integer) from public;
revoke all on function public.search_crm(text, integer) from anon;
grant execute on function public.search_crm(text, integer) to authenticated;

comment on function public.search_crm(text, integer) is
  'RLS-aware global search across active candidates, companies, jobs, and normalized tags.';
