import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260806082425_audit_logs.sql"),
  "utf8",
).toLowerCase();

describe("audit logs migration", () => {
  it("stores immutable audit metadata without copying field values", () => {
    expect(migration).toContain("create table public.audit_logs");
    expect(migration).toContain("changed_fields text[] not null");
    expect(migration).toContain("transaction_id bigint not null");
    expect(migration).not.toContain("old_values");
    expect(migration).not.toContain("new_values");
    expect(migration).not.toMatch(/metadata jsonb|payload jsonb/);
  });

  it("allows only administrators to read and no client to write", () => {
    expect(migration).toContain(
      "alter table public.audit_logs enable row level security",
    );
    expect(migration).toContain(
      "using (public.current_profile_role() = 'admin')",
    );
    expect(migration).toContain(
      "revoke all on table public.audit_logs from authenticated",
    );
    expect(migration).toContain(
      "grant select on table public.audit_logs to authenticated",
    );
    expect(migration).not.toMatch(
      /on public\.audit_logs for (insert|update|delete)/,
    );
  });

  it("records important writes through one protected database trigger", () => {
    expect(migration).toContain(
      "create or replace function public.record_crm_audit_log()",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("after insert or update on public.candidates");
    expect(migration).toContain("after insert or update on public.companies");
    expect(migration).toContain("after insert or update on public.jobs");
    expect(migration).toContain(
      "after insert or update on public.applications",
    );
    expect(migration).toContain("after insert or update on public.tasks");
    expect(migration).toContain(
      "after insert or update on public.ai_summaries",
    );
    expect(migration).not.toContain("after delete");
  });

  it("classifies archive, completion, review, and role changes", () => {
    expect(migration).toContain("then 'archive'");
    expect(migration).toContain("then 'complete'");
    expect(migration).toContain("then 'review'");
    expect(migration).toContain("then 'role_change'");
  });
});
