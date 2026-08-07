import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082301_application_status_history.sql",
  ),
  "utf8",
).toLowerCase();

describe("application status history migration", () => {
  it("creates an indexed RLS-protected history table", () => {
    expect(migration).toContain(
      "create table public.application_status_history",
    );
    expect(migration).toContain(
      "application_id uuid not null references public.applications(id) on delete restrict",
    );
    expect(migration).toContain(
      "alter table public.application_status_history enable row level security",
    );
    expect(migration).toContain(
      "application_status_history_application_changed_idx",
    );
    expect(migration).toContain(
      "application_status_history_status_changed_idx",
    );
    expect(migration).toContain("is_backfilled boolean not null default false");
  });

  it("backfills existing applications and records future status changes", () => {
    expect(migration).toMatch(
      /insert into public\.application_status_history[\s\S]+from public\.applications/,
    );
    expect(migration).toContain("record_application_status_history");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("after insert or update of application_status");
    expect(migration).toContain(
      "new.application_status is distinct from old.application_status",
    );
    expect(migration).toMatch(
      /select[\s\S]+application_status,[\s\S]+owner_id,[\s\S]+true,[\s\S]+created_at[\s\S]+from public\.applications/,
    );
  });

  it("allows desktop clients to read but not mutate history", () => {
    expect(migration).toContain(
      'create policy "authenticated users can read application status history"',
    );
    expect(migration).toContain(
      "revoke insert, update, delete, truncate\non table public.application_status_history from authenticated",
    );
    expect(migration).toContain(
      "grant select on table public.application_status_history to authenticated",
    );
    expect(migration).toContain(
      "revoke execute on function public.record_application_status_history()",
    );
    expect(migration).not.toMatch(
      /on public\.application_status_history for (insert|update|delete)/,
    );
  });
});
