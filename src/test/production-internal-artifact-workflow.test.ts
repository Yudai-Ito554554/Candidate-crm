import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflowPath = path.join(
  process.cwd(),
  ".github/workflows/production-internal-artifacts.yml",
);

describe("production internal artifact workflow", () => {
  it("is manually gated to an immutable commit and isolated GitHub environment", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("release_commit:");
    expect(workflow).toContain("BUILD_PRODUCTION_INTERNAL");
    expect(workflow).toContain("environment: production-internal-build");
    expect(workflow).toContain("ref: ${{ inputs.release_commit }}");
    expect(workflow).toContain("^[0-9a-fA-F]{40}$");
  });

  it("uses only separated production public build settings and fails on staging", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain("VITE_APP_ENV: production");
    expect(workflow).toContain(
      "VITE_SUPABASE_URL: ${{ secrets.PROD_VITE_SUPABASE_URL }}",
    );
    expect(workflow).toContain(
      "VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.PROD_VITE_SUPABASE_PUBLISHABLE_KEY }}",
    );
    expect(workflow).toContain("EXPECTED_PRODUCTION_REF: dsaqarejqslzgcatkxeh");
    expect(workflow).toContain("FORBIDDEN_STAGING_REF: admjgbfrfoczpxdtxmgy");
    expect(workflow).toContain("scripts/verify-build-target.mjs");
    expect(workflow).not.toContain("SERVICE_ROLE");
    expect(workflow).not.toContain("secrets.VITE_SUPABASE_URL");
  });

  it("builds the production Tauri config and labels short-lived artifacts as internal and unsigned", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toMatch(/run: npm run tauri build\s*$/m);
    expect(workflow).not.toContain("tauri.staging.conf.json");
    expect(workflow).toContain(
      "candidate-crm-production-internal-macos-unsigned",
    );
    expect(workflow).toContain(
      "candidate-crm-production-internal-windows-unsigned",
    );
    expect(workflow).toContain("production接続・社内検証版");
    expect(workflow).toContain("retention-days: 3");
  });
});
