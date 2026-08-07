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
});
