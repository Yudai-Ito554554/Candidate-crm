import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082306_company_files_index.sql",
  ),
  "utf8",
).toLowerCase();

describe("company files migration", () => {
  it("indexes active company file metadata by newest first", () => {
    expect(migration).toContain(
      "create index if not exists files_company_created_idx",
    );
    expect(migration).toContain(
      "on public.files (company_id, created_at desc)",
    );
    expect(migration).toContain("where archived_at is null");
  });

  it("does not weaken file RLS or add destructive operations", () => {
    expect(migration).not.toContain("disable row level security");
    expect(migration).not.toMatch(/\b(delete|truncate|drop)\b/);
  });
});
