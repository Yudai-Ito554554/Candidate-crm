import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082308_profile_role_permissions.sql",
  ),
  "utf8",
).toLowerCase();
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082431_profile_role_security_hardening.sql",
  ),
  "utf8",
).toLowerCase();
const accessHardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082433_pending_access_and_email_sync_hardening.sql",
  ),
  "utf8",
).toLowerCase();

describe("profile role permissions migration", () => {
  it("resolves the current role without exposing profile writes", () => {
    expect(migration).toContain(
      "create or replace function public.current_profile_role()",
    );
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = public, pg_temp");
    expect(migration).toContain("where id = (select auth.uid())");
  });

  it("limits role changes to admins and protects the final admin", () => {
    expect(migration).toContain(
      "create or replace function public.set_profile_role",
    );
    expect(migration).toContain("the final administrator cannot be demoted");
    expect(migration).toContain(
      "grant execute on function public.set_profile_role(uuid, text) to authenticated",
    );
  });

  it("fails closed for missing profiles and serializes administrator changes", () => {
    expect(hardeningMigration).toContain(
      "public.current_profile_role() is distinct from 'admin'",
    );
    expect(hardeningMigration).toContain("pg_advisory_xact_lock");
    expect(hardeningMigration).toContain(
      "the final administrator cannot be demoted",
    );
    expect(hardeningMigration).toContain(
      "revoke all on function public.set_profile_role(uuid, text) from public, anon",
    );
  });

  it("allows business writes only for admins and agents", () => {
    expect(migration).toContain(
      'create policy "editors can insert candidates"',
    );
    expect(migration).toContain(
      'create policy "editors can update email thread workflow"',
    );
    expect(migration).toContain('create policy "editors can upload crm files"');
    expect(
      migration.match(/current_profile_role\(\) in \('admin', 'agent'\)/g)
        ?.length,
    ).toBeGreaterThanOrEqual(25);
  });

  it("does not grant anonymous or service-role access", () => {
    expect(migration).not.toContain("service_role");
    expect(migration).not.toMatch(/\bto anon\b/);
  });

  it("keeps new users pending until an administrator approves them", () => {
    expect(accessHardeningMigration).toContain(
      "alter column role set default 'pending'",
    );
    expect(accessHardeningMigration).toContain(
      "workspace members can read candidates",
    );
    expect(accessHardeningMigration).toContain(
      "public.current_profile_role() in ('admin', 'agent', 'viewer')",
    );
    expect(accessHardeningMigration).toContain(
      "approved workspace membership required",
    );
  });

  it("initializes a thread summary when importing historical email", () => {
    expect(accessHardeningMigration).toContain(
      "create or replace function public.refresh_email_thread_from_message()",
    );
    expect(accessHardeningMigration).toContain("last_message_preview is null");
  });
});
