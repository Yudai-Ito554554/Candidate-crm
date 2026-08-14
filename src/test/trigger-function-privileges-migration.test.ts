import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260814110220_restrict_trigger_function_execute.sql",
  ),
  "utf8",
).toLowerCase();

const triggerOnlyFunctions = [
  "set_updated_at",
  "refresh_email_thread_from_message",
  "validate_application_relation",
  "prevent_referenced_application_identity_change",
  "validate_job_contact_company",
  "prevent_archiving_referenced_records",
] as const;

describe("trigger function privilege migration", () => {
  it.each(triggerOnlyFunctions)(
    "revokes direct client execution of %s",
    (functionName) => {
      expect(migration).toContain(
        `revoke execute on function public.${functionName}()`,
      );
    },
  );

  it("does not add a service_role grant", () => {
    expect(migration).not.toMatch(/grant\s+execute[\s\S]*service_role/);
  });

  it("documents the reviewed future email sync grant path", () => {
    expect(migration).toContain("future gmail or outlook synchronization");
    expect(migration).toContain("explicit service_role grant");
  });
});
