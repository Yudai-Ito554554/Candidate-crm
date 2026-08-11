import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflowPath = path.join(
  process.cwd(),
  ".github/workflows/desktop-artifacts.yml",
);

describe("desktop artifact workflow", () => {
  it("ad-hoc signs macOS QA builds before creating and uploading the DMG", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain('apple_signing_identity: "-"');
    expect(workflow).toContain(
      "APPLE_SIGNING_IDENTITY: ${{ matrix.apple_signing_identity }}",
    );
    expect(workflow).toContain(
      'codesign --verify --deep --strict --verbose=2 "$app_path"',
    );
    expect(workflow).toContain(
      'codesign --verify --deep --strict --verbose=2 "$dmg_app_path"',
    );

    expect(workflow.indexOf("APPLE_SIGNING_IDENTITY")).toBeLessThan(
      workflow.indexOf("npm run tauri build"),
    );
    expect(workflow.indexOf("codesign --verify --deep --strict")).toBeLessThan(
      workflow.indexOf("Upload unsigned QA artifacts"),
    );
  });

  it("uploads a concise QA package without the raw macOS app bundle", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain('package_path="artifacts/qa-package"');
    expect(workflow).toContain(
      'cp artifacts/sha256-manifest.json "$package_path/"',
    );
    expect(workflow).toContain('"$package_path/INSTALL.txt"');
    expect(workflow).toContain("path: artifacts/qa-package/");
    expect(workflow).not.toContain(
      "src-tauri/target/release/bundle/macos/*.app",
    );

    expect(workflow.indexOf("Stage concise QA package")).toBeLessThan(
      workflow.indexOf("Upload unsigned QA artifacts"),
    );
  });

  it("builds with the staging Tauri config so the QA app is named and identified distinctly from production", async () => {
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain(
      "npm run tauri build -- --config src-tauri/tauri.staging.conf.json",
    );
    expect(workflow).not.toMatch(/run: npm run tauri build\s*$/m);

    expect(workflow).toContain(
      "artifact_name: candidate-crm-staging-macos-unsigned",
    );
    expect(workflow).toContain(
      "artifact_name: candidate-crm-staging-windows-unsigned",
    );

    expect(workflow).toContain("Candidate CRM STAGING macOS 社内QA版");
    expect(workflow).toContain("Candidate CRM STAGING Windows 社内QA版");
    expect(workflow).toContain("本番版（Candidate CRM）とは別アプリ");

    expect(
      workflow.indexOf("--config src-tauri/tauri.staging.conf.json"),
    ).toBeLessThan(workflow.indexOf("Verify ad-hoc signed macOS bundles"));
  });
});
