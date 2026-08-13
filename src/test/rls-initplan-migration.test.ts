import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260813024735_optimize_rls_role_initplan.sql",
  ),
  "utf8",
).toLowerCase();

describe("RLS role initplan migration", () => {
  it("alters the complete reviewed set of role-dependent policies", () => {
    expect(migration.match(/alter policy /g)).toHaveLength(51);
    expect(
      migration.match(/\(select public\.current_profile_role\(\)\)/g),
    ).toHaveLength(66);
    expect(migration).not.toMatch(
      /(?<!select )public\.current_profile_role\(\)/,
    );
  });

  it("does not mix schema, function, authentication, or audit changes into the optimization", () => {
    expect(migration).not.toMatch(
      /\b(create|drop)\s+(table|policy|function)\b/,
    );
    expect(migration).not.toContain("auth.users");
    expect(migration).not.toContain("record_crm_audit_log");
    expect(migration).not.toContain("grant ");
    expect(migration).not.toContain("revoke ");
  });
});
