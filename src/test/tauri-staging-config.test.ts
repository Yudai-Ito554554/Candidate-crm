import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

interface TauriWindowConfig {
  title?: string;
}

interface TauriPartialConfig {
  productName?: string;
  identifier?: string;
  app?: {
    windows?: TauriWindowConfig[];
  };
}

async function readTauriConfig(fileName: string): Promise<TauriPartialConfig> {
  const source = await readFile(
    path.resolve(process.cwd(), "src-tauri", fileName),
    "utf8",
  );
  return JSON.parse(source) as TauriPartialConfig;
}

describe("Tauri staging config", () => {
  it("names the staging build distinctly so it can coexist with production", async () => {
    const staging = await readTauriConfig("tauri.staging.conf.json");

    expect(staging.productName).toBe("Candidate CRM STAGING");
    expect(staging.identifier).toBe("com.candidatecrm.desktop.staging");
    expect(staging.app?.windows?.[0]?.title).toBe("Candidate CRM STAGING");
  });

  it("differs from the production productName and identifier", async () => {
    const production = await readTauriConfig("tauri.conf.json");
    const staging = await readTauriConfig("tauri.staging.conf.json");

    expect(staging.productName).not.toBe(production.productName);
    expect(staging.identifier).not.toBe(production.identifier);
  });

  it("leaves the production config untouched", async () => {
    const production = await readTauriConfig("tauri.conf.json");

    expect(production.productName).toBe("Candidate CRM");
    expect(production.identifier).toBe("com.candidatecrm.desktop");
    expect(production.app?.windows?.[0]?.title).toBe("Candidate CRM");
  });
});
