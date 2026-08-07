import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082242_initial_crm_schema.sql",
  ),
  "utf8",
).toLowerCase();

const tables = [
  "profiles",
  "candidates",
  "candidate_experiences",
  "companies",
  "company_contacts",
  "jobs",
  "applications",
  "activities",
  "tasks",
  "files",
  "email_threads",
  "email_messages",
  "tags",
  "candidate_tags",
  "company_tags",
  "job_tags",
] as const;

describe("initial CRM migration", () => {
  it.each(tables)("creates and enables RLS for %s", (table) => {
    expect(migration).toContain(`create table public.${table}`);
    expect(migration).toContain(
      `alter table public.${table} enable row level security`,
    );
  });

  it("does not depend on a service-role credential", () => {
    expect(migration).not.toContain("service_role");
    expect(migration).not.toContain("service role");
  });

  it("contains no delete policy and revokes client-side deletes", () => {
    expect(migration).not.toMatch(/on public\.\w+ for delete/);
    expect(migration).toContain("revoke delete, truncate");
  });

  it("protects profile creation and cross-entity application relations", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("validate_application_relation");
    expect(migration).toContain(
      "prevent_referenced_application_identity_change",
    );
    expect(migration).toMatch(
      /insert into public\.profiles[\s\S]+from auth\.users[\s\S]+on conflict \(id\) do nothing/,
    );
  });

  it("uses auth users as the owner identity", () => {
    expect(migration).not.toContain(
      "owner_id uuid references public.profiles(id)",
    );
    expect(
      migration.match(/owner_id uuid references auth\.users\(id\)/g),
    ).toHaveLength(7);
  });

  it("defines the reviewed activity, task, candidate, and company fields", () => {
    expect(migration).toContain("'meeting'");
    expect(migration).toContain("ai_generated boolean not null default false");
    expect(migration).toContain("task_type text not null");
    expect(migration).toContain("private_notes text");
    expect(migration).not.toMatch(
      /\n\s+notes text,[\s\S]*?archived_at[\s\S]*?create table public\.candidate_experiences/,
    );
    expect(migration).toContain("employees integer");
    expect(migration).toContain("capital bigint");
    expect(migration).toContain("listed boolean");
    expect(migration).toContain("website text");
  });

  it("archives candidate experiences instead of deleting them", () => {
    expect(migration).toMatch(
      /create table public\.candidate_experiences[\s\S]*?archived_at timestamptz/,
    );
    expect(migration).toMatch(
      /candidate_experiences_candidate_sort_idx[\s\S]*?where archived_at is null/,
    );
  });

  it("archives company contacts and validates each job contact company", () => {
    expect(migration).toMatch(
      /create table public\.company_contacts[\s\S]*?archived_at timestamptz/,
    );
    expect(migration).toContain("validate_job_contact_company");
    expect(migration).toContain("jobs_validate_contact_company");
    expect(migration).toContain("prevent_archiving_referenced_records");
    expect(migration).toMatch(
      /company_contacts_company_idx[\s\S]*?where archived_at is null/,
    );
  });

  it("soft-archives activities and tasks", () => {
    expect(migration).toMatch(
      /create table public\.activities[\s\S]*?archived_at timestamptz/,
    );
    expect(migration).toMatch(
      /create table public\.tasks[\s\S]*?archived_at timestamptz/,
    );
    expect(migration).toMatch(
      /activities_candidate_occurred_idx[\s\S]*?where archived_at is null/,
    );
    expect(migration).toMatch(
      /tasks_candidate_due_idx[\s\S]*?where archived_at is null/,
    );
  });

  it("uses a private, size-limited storage bucket and soft-archives metadata", () => {
    expect(migration).toContain("'crm-files'");
    expect(migration).toMatch(
      /values \([\s\S]*?'crm-files'[\s\S]*?false,[\s\S]*?10485760/,
    );
    expect(migration).toContain("authenticated users can read crm files");
    expect(migration).toContain("authenticated users can upload crm files");
    expect(migration).toMatch(
      /create table public\.files[\s\S]*?archived_at timestamptz/,
    );
    expect(migration).toMatch(
      /files_candidate_created_idx[\s\S]*?where archived_at is null/,
    );
    expect(migration).toContain(
      "grant update (archived_at) on table public.files to authenticated",
    );
  });

  it("limits storage cleanup to the current user's upload folder", () => {
    expect(migration).toContain("users can clean up their failed crm uploads");
    expect(migration).toContain(
      "(storage.foldername(name))[1] = (select auth.uid())::text",
    );
  });

  it("models email threads separately from immutable messages", () => {
    expect(migration).toContain("create table public.email_threads");
    expect(migration).toContain("create table public.email_messages");
    expect(migration).toContain("email_messages_refresh_thread");
    expect(migration).toContain("email_threads_validate_application_relation");
    expect(migration).toContain(
      "grant update (status, archived_at) on table public.email_threads to authenticated",
    );
    expect(migration).toContain(
      "revoke insert, update, delete, truncate on table public.email_messages from authenticated",
    );
  });
});
