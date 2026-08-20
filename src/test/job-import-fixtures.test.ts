import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { JOB_IMPORT_MAX_PDF_BYTES } from "@/features/applications/job-import-model";

const fixtureTextPath = path.resolve(
  process.cwd(),
  "docs/fixtures/job-import-sample.txt",
);
const fixturePdfPath = path.resolve(
  process.cwd(),
  "output/pdf/candidate-crm-job-import-sample.pdf",
);
const fixture = (name: string) =>
  path.resolve(process.cwd(), "docs/fixtures", name);
const CACHE_VARIANT_NAME = "job-import-cache-variant.pdf";

/** Mirrors PDF_TRAILER_SCAN_BYTES in job-import-model.ts. */
function trailerOf(file: Buffer): string {
  return file.subarray(Math.max(0, file.byteLength - 2_048)).toString("latin1");
}

describe("job import UAT fixtures", () => {
  it("uses clearly fictional but extractable job data", async () => {
    const contents = await readFile(fixtureTextPath, "utf8");

    expect(contents).toContain("株式会社メディカルフロンティア（架空企業）");
    expect(contents).toContain("整形外科領域 医療機器営業");
    expect(contents).toContain("想定年収：600万円から850万円");
    expect(contents).toContain("実在する企業・求人とは関係ありません");
  });

  it("keeps the PDF safe, text-capable, and within the upload limit", async () => {
    const pdf = await readFile(fixturePdfPath);
    const structure = pdf.toString("latin1");

    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1_000);
    expect(pdf.byteLength).toBeLessThanOrEqual(JOB_IMPORT_MAX_PDF_BYTES);
    expect(structure.match(/\/Type\s*\/Page\b/g)).toHaveLength(1);
    expect(structure).toContain("/FontFile2");
    expect(structure).toContain("/ToUnicode");
    expect(structure).not.toContain("/Encrypt");
    expect(structure).not.toContain("/JavaScript");
  });

  it("keeps a rejection fixture for each PDF validation branch", async () => {
    const fake = await readFile(fixture("job-import-fake.pdf"));
    const truncated = await readFile(fixture("job-import-truncated.pdf"));
    const encrypted = await readFile(
      fixture("job-import-password-protected.pdf"),
    );

    // Each file must fail exactly the check it stands for, so a passing UAT
    // step cannot be explained by an earlier branch firing first.
    expect(fake.subarray(0, 5).toString("ascii")).not.toBe("%PDF-");

    expect(truncated.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(trailerOf(truncated)).not.toContain("%%EOF");

    expect(encrypted.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(trailerOf(encrypted)).toContain("%%EOF");
    expect(trailerOf(encrypted)).toContain("/Encrypt");

    for (const file of [fake, truncated, encrypted]) {
      expect(file.byteLength).toBeGreaterThan(0);
      expect(file.byteLength).toBeLessThanOrEqual(JOB_IMPORT_MAX_PDF_BYTES);
    }
  });

  it("keeps the cache variants same-named and same-sized but distinct", async () => {
    const a = await readFile(fixture(`cache-variant-a/${CACHE_VARIANT_NAME}`));
    const b = await readFile(fixture(`cache-variant-b/${CACHE_VARIANT_NAME}`));

    expect(a.byteLength).toBe(b.byteLength);
    expect(a.equals(b)).toBe(false);
    for (const file of [a, b]) {
      expect(file.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(trailerOf(file)).toContain("%%EOF");
      expect(trailerOf(file)).not.toContain("/Encrypt");
    }
  });

  it("gives the company conflict fixture both a name and a website", async () => {
    const contents = await readFile(
      fixture("job-import-company-conflict.txt"),
      "utf8",
    );

    // The extractor drops a parenthetical suffix, so the name it returns would
    // stop matching a company registered under the annotated form.
    expect(contents).toContain("株式会社メディカルフロンティア\n");
    expect(contents).not.toContain(
      "株式会社メディカルフロンティア（架空企業）",
    );
    expect(contents).toContain(
      "Webサイト：https://medical-frontier.example/recruit",
    );
    expect(contents).toContain("業種：医療機器");
    expect(contents).toContain("実在する企業・求人とは関係ありません");
  });
});
