import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806110008_complete_candidate_next_action.sql",
  ),
  "utf8",
).toLowerCase();

describe("complete candidate next action migration", () => {
  it("completes the action atomically and preserves it as a timeline activity", () => {
    expect(migration).toContain(
      "create or replace function public.complete_candidate_next_action",
    );
    expect(migration).toContain("security invoker");
    expect(migration).toContain("for update");
    expect(migration).toContain("insert into public.activities");
    expect(migration).toContain("current_action");
    expect(migration).toContain("next_action = null");
    expect(migration).toContain("next_action_due_at = null");
    expect(migration).toContain("waiting_on = 'none'");
  });

  it("allows only authenticated editors to execute the function", () => {
    expect(migration).toContain(
      "public.current_profile_role() not in ('admin', 'agent')",
    );
    expect(migration).toContain(
      "revoke all on function public.complete_candidate_next_action(uuid)",
    );
    expect(migration).toContain("from public, anon");
    expect(migration).toContain(
      "grant execute on function public.complete_candidate_next_action(uuid)",
    );
    expect(migration).toContain("to authenticated");
  });
});
