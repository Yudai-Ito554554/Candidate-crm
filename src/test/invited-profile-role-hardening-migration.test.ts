import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814105946_restrict_invited_profile_role_to_pending.sql",
  ),
  "utf8",
).toLowerCase();

describe("invited profile role hardening migration", () => {
  it("limits invite role assignment to pending profiles", () => {
    expect(migration).toContain(
      "create or replace function public.apply_invited_profile_role",
    );
    expect(migration).toMatch(
      /where id = target_user_id\s+and role = 'pending'/,
    );
    expect(migration).toContain("errcode = 'p0002'");
  });

  it("keeps the RPC restricted to service_role", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
