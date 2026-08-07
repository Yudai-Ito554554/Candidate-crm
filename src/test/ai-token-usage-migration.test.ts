import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806234328_ai_token_usage.sql",
  ),
  "utf8",
).toLowerCase();

describe("AI token usage migration", () => {
  it("adds nonnegative token counters to both server-only request tables", () => {
    expect(migration).toContain("alter table public.ai_generation_requests");
    expect(migration).toContain("alter table public.job_import_requests");
    expect(migration).toContain("add column input_tokens bigint");
    expect(migration).toContain("add column output_tokens bigint");
    expect(migration).toContain("input_tokens is null or input_tokens >= 0");
    expect(migration).toContain("output_tokens is null or output_tokens >= 0");
  });

  it("returns only aggregate counts and keeps the RPC service-only", () => {
    expect(migration).toContain("input_token_count bigint");
    expect(migration).toContain("output_token_count bigint");
    expect(migration).toContain("coalesce(sum(usage_events.input_tokens), 0)");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain(
      "revoke all on function public.get_ai_usage_snapshot() from authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_ai_usage_snapshot() to service_role",
    );
    expect(migration).not.toMatch(
      /\b(prompt_text|provider_output|source_text|source_url|file_name)\b/,
    );
  });
});
