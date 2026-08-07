import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806142039_global_ai_rate_limit.sql",
  ),
  "utf8",
).toLowerCase();

describe("global AI rate-limit migration", () => {
  it("counts candidate summaries and job imports under one quota", () => {
    expect(migration).toContain("private.prepare_ai_usage_quota");
    expect(migration).toContain("from public.ai_generation_requests");
    expect(migration).toContain("from public.job_import_requests");
    expect(migration).toContain("union all");
    expect(migration).toContain("interval '1 hour'");
    expect(migration).toContain("hourly_request_count >= 20");
    expect(migration).toContain("interval '1 day'");
    expect(migration).toContain("daily_request_count >= 50");
  });

  it("serializes both claim functions with the same per-user lock", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(
      "perform private.prepare_ai_usage_quota(requester_id, request_time)",
    );
    expect(migration).toContain(
      "create or replace function public.claim_candidate_ai_request",
    );
    expect(migration).toContain(
      "create or replace function public.claim_job_import_request",
    );
  });

  it("keeps claim operations server-only", () => {
    expect(migration).toContain(
      "revoke all on function public.claim_candidate_ai_request(uuid, uuid) from authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.claim_candidate_ai_request(uuid, uuid) to service_role",
    );
    expect(migration).toContain(
      "revoke all on function public.claim_job_import_request(uuid, text) from authenticated",
    );
    expect(migration).toContain("set search_path = ''");
  });

  it("retains candidate cooldown and stale-request recovery", () => {
    expect(migration).toContain("interval '5 minutes'");
    expect(migration).toContain("ai_candidate_cooldown");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toContain("stale_request");
  });
});
