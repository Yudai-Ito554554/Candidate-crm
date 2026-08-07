import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260806082322_ai_summaries.sql"),
  "utf8",
).toLowerCase();

describe("AI summaries migration", () => {
  it("stores structured candidate analysis and generation provenance", () => {
    expect(migration).toContain("create table public.ai_summaries");
    expect(migration).toContain("candidate_summary text");
    expect(migration).toContain("change_reason_summary text");
    expect(migration).toContain("recommended_jobs text");
    expect(migration).toContain("model text not null");
    expect(migration).toContain("prompt_version text not null");
    expect(migration).toContain("source_activity_through_at timestamptz");
  });

  it("keeps generation server-side and allows only human review updates", () => {
    expect(migration).toContain(
      "revoke insert, delete, truncate on table public.ai_summaries from authenticated",
    );
    expect(migration).toContain(
      "grant update (reviewed_by, reviewed_at) on table public.ai_summaries to authenticated",
    );
    expect(migration).toContain("reviewed_by = (select auth.uid())");
    expect(migration).toContain("and reviewed_by is null");
    expect(migration).toContain("and reviewed_at is null");
    expect(migration).toContain(
      "public.current_profile_role() in ('admin', 'agent')",
    );
  });

  it("enables RLS and indexes active summaries by candidate", () => {
    expect(migration).toContain(
      "alter table public.ai_summaries enable row level security",
    );
    expect(migration).toContain("ai_summaries_candidate_generated_idx");
    expect(migration).toContain("where archived_at is null");
    expect(migration).not.toContain("service_role");
  });
});
