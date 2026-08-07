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
});
