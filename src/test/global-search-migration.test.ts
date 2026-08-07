import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082412_global_search.sql",
  ),
  "utf8",
).toLowerCase();

describe("global search migration", () => {
  it("adds Japanese-friendly trigram indexes for active CRM records", () => {
    expect(migration).toContain(
      "create extension if not exists pg_trgm with schema extensions",
    );
    expect(migration).toContain("candidates_global_search_trgm_idx");
    expect(migration).toContain("companies_global_search_trgm_idx");
    expect(migration).toContain("jobs_global_search_trgm_idx");
    expect(migration).toContain("tags_global_search_trgm_idx");
    expect(migration.match(/extensions\.gin_trgm_ops/g)).toHaveLength(4);
    expect(
      migration.match(/where archived_at is null/g)?.length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("searches candidates, companies, jobs, and normalized tags", () => {
    expect(migration).toContain("create or replace function public.search_crm");
    expect(migration).toContain("from public.candidates as candidate");
    expect(migration).toContain("from public.companies as company");
    expect(migration).toContain("from public.jobs as job");
    expect(migration).toContain("public.candidate_tags");
    expect(migration).toContain("public.company_tags");
    expect(migration).toContain("public.job_tags");
    expect(migration).toContain(
      "least(greatest(coalesce(result_limit, 12), 1), 30)",
    );
  });

  it("uses invoker RLS and exposes the RPC only to authenticated users", () => {
    expect(migration).toContain("security invoker");
    expect(migration).not.toContain("security definer");
    expect(migration).toContain(
      "revoke all on function public.search_crm(text, integer) from anon",
    );
    expect(migration).toContain(
      "grant execute on function public.search_crm(text, integer) to authenticated",
    );
  });
});
