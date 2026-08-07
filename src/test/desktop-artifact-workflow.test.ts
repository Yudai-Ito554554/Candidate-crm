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
});
