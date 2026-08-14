import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

describe("Batch 5 secure session configuration", () => {
  it("supabase-jsのWebView永続化を無効にする", () => {
    const source = readFileSync(resolve("src/lib/supabase.ts"), "utf8");
    expect(source).toContain("persistSession: false");
    expect(source).not.toContain("persistSession: true");
  });

  it("資格情報commandをmain window capabilityだけに許可する", () => {
    const capability = JSON.parse(
      readFileSync(resolve("src-tauri/capabilities/default.json"), "utf8"),
    ) as { windows: string[]; permissions: string[] };
    expect(capability.windows).toEqual(["main"]);
    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        "allow-secure-credential-set",
        "allow-secure-credential-get",
        "allow-secure-credential-delete",
      ]),
    );
  });

  it("Tauri identifierとRust資格情報serviceの対応を固定する", () => {
    const productionConfig = JSON.parse(
      readFileSync(resolve("src-tauri/tauri.conf.json"), "utf8"),
    ) as { identifier: string };
    const stagingConfig = JSON.parse(
      readFileSync(resolve("src-tauri/tauri.staging.conf.json"), "utf8"),
    ) as { identifier: string };
    const rustSource = readFileSync(resolve("src-tauri/src/lib.rs"), "utf8");

    expect(productionConfig.identifier).toBe("com.candidatecrm.desktop");
    expect(stagingConfig.identifier).toBe("com.candidatecrm.desktop.staging");
    expect(rustSource).toContain(
      `"${productionConfig.identifier}" => Ok(PRODUCTION_CREDENTIAL_SERVICE)`,
    );
    expect(rustSource).toContain(
      `"${stagingConfig.identifier}" => Ok(STAGING_CREDENTIAL_SERVICE)`,
    );
    expect(rustSource).toContain(
      'const PRODUCTION_CREDENTIAL_SERVICE: &str = "com.candidatecrm.desktop.production";',
    );
    expect(rustSource).toContain(
      'const STAGING_CREDENTIAL_SERVICE: &str = "com.candidatecrm.desktop.staging";',
    );
  });

  it("Batch 5でSupabase migrationを追加しない", () => {
    const migrations = readdirSync(resolve("supabase/migrations"));
    expect(
      migrations.some((name) =>
        /keychain|credential|secure_session/.test(name),
      ),
    ).toBe(false);
  });
});
