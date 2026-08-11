import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const scriptPath = path.join(process.cwd(), "scripts/verify-build-target.mjs");
const execFileAsync = promisify(execFile);
const productionRef = "dsaqarejqslzgcatkxeh";
const stagingRef = "admjgbfrfoczpxdtxmgy";

async function runVerifier(
  environment: NodeJS.ProcessEnv,
  distDirectory?: string,
) {
  const argumentsList = [
    scriptPath,
    `--expected-ref=${productionRef}`,
    `--forbidden-ref=${stagingRef}`,
  ];

  if (distDirectory) {
    argumentsList.push(`--dist=${distDirectory}`);
  }

  return execFileAsync(process.execPath, argumentsList, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      VITE_APP_ENV: "production",
      VITE_SUPABASE_URL: `https://${productionRef}.supabase.co`,
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      ...environment,
    },
  });
}

function hasStandardError(error: unknown): error is Error & { stderr: string } {
  return (
    error instanceof Error &&
    "stderr" in error &&
    typeof error.stderr === "string"
  );
}

describe("production build target verifier", () => {
  it("validates the environment URL and scans built assets without printing secrets", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain('process.env.VITE_APP_ENV !== "production"');
    expect(script).toContain(
      "parsedSupabaseUrl.origin !== `https://${expectedRef}.supabase.co`",
    );
    expect(script).toContain("text.includes(forbiddenRef)");
    expect(script).toContain("text.includes(expectedRef)");
    expect(script).not.toContain("process.stdout.write(supabaseUrl");
    expect(script).not.toContain("process.stdout.write(publishableKey");
  });

  it("accepts production settings and production-only built assets", async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "candidate-crm-prod-build-test-"),
    );

    try {
      await writeFile(
        path.join(temporaryDirectory, "index.js"),
        `const project = "${productionRef}";\n`,
        "utf8",
      );

      const result = await runVerifier({}, temporaryDirectory);
      expect(result.stdout).toContain(
        "Production build target verification passed.",
      );
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("rejects a staging URL before building", async () => {
    try {
      await runVerifier({
        VITE_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
      });
      expect.unreachable("The staging URL should have been rejected.");
    } catch (error: unknown) {
      expect(hasStandardError(error)).toBe(true);
      if (!hasStandardError(error)) {
        throw error;
      }
      expect(error.stderr).toContain(
        "Supabase URL does not match the expected production project ref.",
      );
    }
  });

  it("rejects staging references embedded in built assets", async () => {
    const temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "candidate-crm-prod-build-test-"),
    );

    try {
      await writeFile(
        path.join(temporaryDirectory, "index.js"),
        `const refs = ["${productionRef}", "${stagingRef}"];\n`,
        "utf8",
      );

      try {
        await runVerifier({}, temporaryDirectory);
        expect.unreachable("The staging asset should have been rejected.");
      } catch (error: unknown) {
        expect(hasStandardError(error)).toBe(true);
        if (!hasStandardError(error)) {
          throw error;
        }
        expect(error.stderr).toContain(
          "Staging project ref was found in built frontend assets.",
        );
      }
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });
});
