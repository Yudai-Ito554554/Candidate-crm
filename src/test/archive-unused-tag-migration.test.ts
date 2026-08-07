import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806105136_archive_unused_tag.sql",
  ),
  "utf8",
).toLowerCase();

describe("archive unused tag migration", () => {
  it("blocks active relations and avoids physical deletion", () => {
    expect(migration).toContain(
      "create or replace function public.archive_unused_tag",
    );
    expect(migration).toContain("from public.candidate_tags");
    expect(migration).toContain("from public.company_tags");
    expect(migration).toContain("from public.job_tags");
    expect(migration).toContain("set archived_at = now()");
    expect(migration).not.toMatch(/delete\s+from\s+public\.tags/);
  });

  it("requires an editor and grants only authenticated execution", () => {
    expect(migration).toContain(
      "public.current_profile_role() not in ('admin', 'agent')",
    );
    expect(migration).toContain(
      "revoke all on function public.archive_unused_tag(uuid) from public, anon",
    );
    expect(migration).toContain(
      "grant execute on function public.archive_unused_tag(uuid) to authenticated",
    );
  });
});
