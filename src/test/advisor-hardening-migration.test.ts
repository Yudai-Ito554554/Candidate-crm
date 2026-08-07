import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806083047_advisor_security_and_fk_indexes.sql",
  ),
  "utf8",
).toLowerCase();

describe("advisor hardening migration", () => {
  it("removes anonymous access to the role helper and API access to the trigger function", () => {
    expect(migration).toContain(
      "revoke all on function public.current_profile_role() from public, anon",
    );
    expect(migration).toContain(
      "revoke all on function public.handle_new_user() from public, anon, authenticated",
    );
  });

  it("adds covering indexes for every foreign key reported by the advisor", () => {
    expect(migration.match(/create index /g)).toHaveLength(20);
    expect(migration).toContain("on public.activities (application_id)");
    expect(migration).toContain("on public.ai_summaries (reviewed_by)");
    expect(migration).toContain("on public.tasks (job_id)");
  });
});
