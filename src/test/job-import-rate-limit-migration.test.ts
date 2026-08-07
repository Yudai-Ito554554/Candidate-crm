import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806141048_job_import_rate_limit.sql",
  ),
  "utf8",
).toLowerCase();

describe("job import rate-limit migration", () => {
  it("stores only server-side usage metadata with RLS", () => {
    expect(migration).toContain("create table public.job_import_requests");
    expect(migration).toContain("references auth.users(id)");
    expect(migration).toContain(
      "alter table public.job_import_requests enable row level security",
    );
    expect(migration).toContain(
      "revoke all on table public.job_import_requests from authenticated",
    );
    expect(migration).not.toMatch(
      /\b(source_text|source_url|file_name|prompt|response|extracted_data)\b/,
    );
  });

  it("serializes and atomically enforces every quota", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("job_import_requests_active_user_idx");
    expect(migration).toContain("where status = 'running'");
    expect(migration).toContain("interval '1 hour'");
    expect(migration).toContain(") >= 20");
    expect(migration).toContain("interval '1 day'");
    expect(migration).toContain(") >= 50");
  });

  it("exposes the claim function only to the service role", () => {
    expect(migration).toContain(
      "revoke all on function public.claim_job_import_request(uuid, text) from authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.claim_job_import_request(uuid, text) to service_role",
    );
    expect(migration).toContain("set search_path = ''");
  });
});
