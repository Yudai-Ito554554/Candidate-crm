import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082303_candidate_views.sql",
  ),
  "utf8",
).toLowerCase();

describe("candidate views migration", () => {
  it("creates one view record per user and candidate", () => {
    expect(migration).toContain("create table public.candidate_views");
    expect(migration).toContain("primary key (user_id, candidate_id)");
    expect(migration).toContain("candidate_views_user_viewed_idx");
    expect(migration).toContain(
      "candidate_id uuid not null references public.candidates(id) on delete cascade",
    );
  });

  it("restricts reads to the current user and writes to a narrow RPC", () => {
    expect(migration).toContain(
      "alter table public.candidate_views enable row level security",
    );
    expect(migration.match(/\(select auth\.uid\(\)\)/g)).toHaveLength(2);
    expect(migration).toContain(
      "create function public.record_candidate_view(target_candidate_id uuid)",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("on conflict (user_id, candidate_id)");
    expect(migration).toContain(
      "revoke insert, update, delete, truncate\non table public.candidate_views from authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.record_candidate_view(uuid) to authenticated",
    );
    expect(migration).not.toMatch(/on public\.candidate_views for delete/);
  });
});
