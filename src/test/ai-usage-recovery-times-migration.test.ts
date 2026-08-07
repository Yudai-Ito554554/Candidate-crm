import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806232937_ai_usage_recovery_times.sql",
  ),
  "utf8",
).toLowerCase();

describe("AI usage recovery time migration", () => {
  it("calculates rolling hourly and daily recovery timestamps", () => {
    expect(migration).toContain("next_hourly_recovery_at timestamptz");
    expect(migration).toContain("next_daily_recovery_at timestamptz");
    expect(migration).toContain("min(usage_events.requested_at) filter");
    expect(migration).toContain("+ interval '1 hour'");
    expect(migration).toContain("+ interval '1 day'");
  });

  it("keeps the aggregate service-only and free of business content", () => {
    expect(migration).toContain(
      "revoke all on function public.get_ai_usage_snapshot() from authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_ai_usage_snapshot() to service_role",
    );
    expect(migration).not.toMatch(
      /\b(candidate_id|prompt_text|provider_output|source_text)\b/,
    );
  });
});
