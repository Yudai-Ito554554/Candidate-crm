import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260807000240_ai_model_usage.sql",
  ),
  "utf8",
).toLowerCase();

describe("AI model usage migration", () => {
  it("adds a bounded provider model identifier to both request tables", () => {
    expect(migration).toContain("alter table public.ai_generation_requests");
    expect(migration).toContain("alter table public.job_import_requests");
    expect(migration).toContain("add column provider_model text");
    expect(migration).toContain("provider_model = btrim(provider_model)");
    expect(migration).toContain(
      "char_length(provider_model) between 1 and 100",
    );
  });

  it("groups the service-only usage aggregate by provider model", () => {
    expect(migration).toContain("provider_model text");
    expect(migration).toContain("usage_events.provider_model");
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
