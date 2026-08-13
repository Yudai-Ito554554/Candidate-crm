import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const functionSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/invite-user/index.ts"),
  "utf8",
).toLowerCase();
const supabaseConfig = readFileSync(
  resolve(process.cwd(), "supabase/config.toml"),
  "utf8",
).toLowerCase();
const tauriConfig = readFileSync(
  resolve(process.cwd(), "src-tauri/tauri.conf.json"),
  "utf8",
).toLowerCase();
const cargoManifest = readFileSync(
  resolve(process.cwd(), "src-tauri/cargo.toml"),
  "utf8",
).toLowerCase();
const rustSource = readFileSync(
  resolve(process.cwd(), "src-tauri/src/lib.rs"),
  "utf8",
).toLowerCase();

describe("user invitation", () => {
  it("keeps privileged Auth administration in an admin-only Edge Function", () => {
    expect(functionSource).toContain("auth.getuser(token)");
    expect(functionSource).toContain('callerprofile?.role !== "admin"');
    expect(functionSource).toContain("auth.admin.inviteuserbyemail");
    expect(functionSource).toContain(
      '.rpc(\n      "apply_invited_profile_role"',
    );
    expect(functionSource).not.toMatch(
      /\.from\(["']profiles["']\)\s*\.update\(/,
    );
    expect(functionSource).toContain(
      'const invite_redirect_url = "candidate-crm://auth/callback"',
    );
    expect(functionSource).toContain('role !== "agent"');
    expect(functionSource).toContain('role !== "viewer"');
    expect(functionSource).not.toContain("vite_supabase_service");
    expect(supabaseConfig).toContain("[functions.invite-user]");
    expect(supabaseConfig).toContain("verify_jwt = true");
  });

  it("configures macOS and Windows deep-link delivery", () => {
    expect(tauriConfig).toContain('"schemes": ["candidate-crm"]');
    expect(cargoManifest).toContain(
      'tauri-plugin-single-instance = { version = "2", features = ["deep-link"] }',
    );
    expect(
      rustSource.indexOf("tauri_plugin_single_instance::init"),
    ).toBeLessThan(rustSource.indexOf("tauri_plugin_deep_link::init"));
  });
});
