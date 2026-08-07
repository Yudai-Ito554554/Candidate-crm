import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806125306_guard_job_restore_dependencies.sql",
  ),
  "utf8",
).toLowerCase();

describe("job restore dependency migration", () => {
  it("rejects restoring a job whose company or contact remains archived", () => {
    expect(migration).toContain("old.archived_at is null");
    expect(migration).toContain("companies");
    expect(migration).toContain("company_contacts");
    expect(migration).toContain(
      "cannot restore job while its company is archived",
    );
    expect(migration).toContain(
      "cannot restore job while its contact is archived",
    );
  });

  it("installs a trigger and keeps the trigger function out of the Data API", () => {
    expect(migration).toContain("jobs_validate_restore_dependencies");
    expect(migration).toContain(
      "revoke all on function public.validate_job_restore_dependencies()",
    );
    expect(migration).toContain("from public, anon, authenticated");
  });
});
