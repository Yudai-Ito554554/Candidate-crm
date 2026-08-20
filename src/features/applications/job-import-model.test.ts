import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  JOB_IMPORT_MAX_PDF_BYTES,
  countExtractedJobFields,
  getEvidenceBackedJobImportFields,
  getJobImportDiff,
  getJobImportEvidence,
  getJobImportReadiness,
  getRecommendedJobImportFields,
  getUnverifiedJobImportFields,
  getJobImportSourceKey,
  getJobImportSourceLabel,
  resolveJobImportCompanyMatch,
  toImportedCompanyDraft,
  toJobImportFormPatch,
  updateJobImportFieldSelection,
  validateJobImportPdfSignature,
  validateJobImportSource,
  type JobImportResult,
} from "@/features/applications/job-import-model";
import { toJobFormValues } from "@/features/applications/job-form-model";
import type { CompanyRow } from "@/types/database";

const extracted: JobImportResult = {
  company_name: " メディカルデバイス 株式会社 ",
  company_industry: " 医療機器メーカー ",
  company_website: " https://medical-device.example.jp ",
  title: "循環器製品 営業担当",
  division: "循環器事業部",
  occupation: "医療機器営業",
  employment_type: "正社員",
  locations: ["東京都", "大阪府"],
  salary_min: 600,
  salary_max: 900,
  required_conditions: "医療業界での営業経験",
  preferred_conditions: "循環器領域の経験",
  description: "基幹病院への提案営業",
  opened_at: "2026-08-01",
  closed_at: null,
  warnings: [],
  missing_fields: [],
  evidence: [
    { field: "title", quote: "募集職種：循環器製品 営業担当" },
    { field: "salary_min", quote: "想定年収 600万円〜900万円" },
    { field: "salary_max", quote: "想定年収 600万円〜900万円" },
  ],
};

const company = {
  id: "company-001",
  name: "メディカルデバイス株式会社",
  website: "https://medical-device.example.jp/",
} as CompanyRow;

describe("job import model", () => {
  it("returns only the source evidence related to a form field", () => {
    expect(getJobImportEvidence(extracted, "title")).toEqual([
      "募集職種：循環器製品 営業担当",
    ]);
    expect(getJobImportEvidence(extracted, "salary_min")).toEqual([
      "想定年収 600万円〜900万円",
    ]);
    expect(getJobImportEvidence(extracted, "contact_id")).toEqual([]);
  });

  it("identifies selected imported fields that have no source evidence", () => {
    const patch = toJobImportFormPatch(extracted, [company]);
    const differences = getJobImportDiff(toJobFormValues(), patch, [company]);

    expect(
      getUnverifiedJobImportFields(extracted, differences, [
        "title",
        "division",
        "contact_id",
      ]).map((difference) => difference.field),
    ).toEqual(["division"]);
  });

  it("selects only evidence-backed fields and keeps a dependent contact clear", () => {
    const supportedCompanyResult: JobImportResult = {
      ...extracted,
      evidence: [
        ...extracted.evidence,
        {
          field: "company_name",
          quote: "会社名：メディカルデバイス株式会社",
        },
      ],
    };
    const currentValues = {
      ...toJobFormValues(),
      company_id: "company-old",
      contact_id: "contact-old",
    };
    const patch = toJobImportFormPatch(supportedCompanyResult, [company]);
    const differences = getJobImportDiff(currentValues, patch, [company]);

    expect(
      getEvidenceBackedJobImportFields(supportedCompanyResult, differences),
    ).toEqual([
      "company_id",
      "contact_id",
      "title",
      "salary_min",
      "salary_max",
    ]);
  });

  it("maps extracted values and matches one company by normalized name and website", () => {
    const patch = toJobImportFormPatch(extracted, [company]);

    expect(patch.matchedCompany?.id).toBe("company-001");
    expect(patch.matchedCompanyFields).toEqual(["企業名", "Webサイト"]);
    expect(patch.companyMatchConflict).toBe(false);
    expect(patch.values).toMatchObject({
      company_id: "company-001",
      contact_id: "",
      title: "循環器製品 営業担当",
      locations: "東京都、大阪府",
      salary_min: "600",
      salary_max: "900",
    });
    expect(patch.values).not.toHaveProperty("closed_at");
    expect(patch.values).not.toHaveProperty("internal_notes");
  });

  it("builds an editable company draft without mixing company metadata into job fields", () => {
    expect(toImportedCompanyDraft(extracted)).toEqual({
      name: "メディカルデバイス 株式会社",
      industry: "医療機器メーカー",
      website: "https://medical-device.example.jp",
    });
    expect(toJobImportFormPatch(extracted, []).values).not.toHaveProperty(
      "company_industry",
    );
  });

  it("matches the existing company by website when the extracted name differs", () => {
    const patch = toJobImportFormPatch(
      { ...extracted, company_name: "メディカルデバイス株式会社 東京支店" },
      [company],
    );

    expect(patch.matchedCompany?.id).toBe("company-001");
    expect(patch.matchedCompanyFields).toEqual(["Webサイト"]);
  });

  it("does not select a similar name when no website match exists", () => {
    const patch = toJobImportFormPatch(
      {
        ...extracted,
        company_name: "メディカルデバイス株式会社 東京支店",
        company_website: null,
      },
      [company],
    );

    expect(patch.matchedCompany).toBeNull();
    expect(patch.values).not.toHaveProperty("company_id");
  });

  it("does not auto-select when the name and website identify different companies", () => {
    const nameMatch = {
      ...company,
      website: "https://different.example.jp",
    };
    const websiteMatch = {
      ...company,
      id: "company-002",
      name: "別の登録済み企業",
    };
    const patch = toJobImportFormPatch(extracted, [nameMatch, websiteMatch]);

    expect(patch.companyMatchConflict).toBe(true);
    expect(patch.matchedCompany).toBeNull();
    expect(patch.matchedCompanyFields).toEqual([]);
    expect(patch.values).not.toHaveProperty("company_id");

    const resolved = resolveJobImportCompanyMatch(patch, websiteMatch.id);
    expect(resolved.companyMatchConflict).toBe(false);
    expect(resolved.matchedCompany?.id).toBe("company-002");
    expect(resolved.matchedCompanyFields).toEqual(["Webサイト"]);
    expect(resolved.values).toMatchObject({
      company_id: "company-002",
      contact_id: "",
    });
    expect(resolveJobImportCompanyMatch(patch, "unknown-company")).toBe(patch);
  });

  it("keeps existing form values when AI did not extract that field", () => {
    const patch = toJobImportFormPatch(
      {
        ...extracted,
        description: null,
        preferred_conditions: null,
        locations: [],
        salary_max: null,
      },
      [company],
    );

    expect(patch.values).not.toHaveProperty("description");
    expect(patch.values).not.toHaveProperty("preferred_conditions");
    expect(patch.values).not.toHaveProperty("locations");
    expect(patch.values).not.toHaveProperty("salary_max");
  });

  it("describes additions and overwrites before applying them", () => {
    const current = {
      ...toJobFormValues(),
      company_id: "company-old",
      title: "既存の求人名",
      occupation: "",
    };
    const patch = toJobImportFormPatch(extracted, [company]);
    const differences = getJobImportDiff(current, patch, [company]);

    expect(differences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "company_id",
          label: "企業",
          currentValue: "未登録企業",
          importedValue: "メディカルデバイス株式会社",
          kind: "change",
        }),
        expect.objectContaining({
          field: "title",
          currentValue: "既存の求人名",
          importedValue: "循環器製品 営業担当",
          kind: "change",
        }),
        expect.objectContaining({
          field: "occupation",
          kind: "add",
        }),
      ]),
    );
    expect(getRecommendedJobImportFields(differences)).toContain("occupation");
    expect(getRecommendedJobImportFields(differences)).not.toContain("title");
    expect(getRecommendedJobImportFields(differences)).not.toContain(
      "company_id",
    );
  });

  it("keeps company changes and the required contact reset together", () => {
    const current = {
      ...toJobFormValues(),
      company_id: "company-old",
      contact_id: "contact-old",
    };
    const differences = getJobImportDiff(
      current,
      toJobImportFormPatch(extracted, [company]),
      [company],
    );

    const withCompany = updateJobImportFieldSelection(
      [],
      "company_id",
      true,
      differences,
    );
    expect(withCompany).toEqual(
      expect.arrayContaining(["company_id", "contact_id"]),
    );

    const withoutContact = updateJobImportFieldSelection(
      withCompany,
      "contact_id",
      false,
      differences,
    );
    expect(withoutContact).not.toContain("company_id");
    expect(withoutContact).not.toContain("contact_id");
  });

  it("reports required fields using the selected import preview", () => {
    const current = toJobFormValues();
    const unmatchedPatch = toJobImportFormPatch(extracted, []);
    const unmatchedFields = getRecommendedJobImportFields(
      getJobImportDiff(current, unmatchedPatch, []),
    );
    expect(
      getJobImportReadiness(current, unmatchedPatch, unmatchedFields),
    ).toEqual({
      ready: false,
      missingRequiredFields: ["企業"],
      validationIssues: [],
    });

    const matchedPatch = toJobImportFormPatch(extracted, [company]);
    const matchedFields = getRecommendedJobImportFields(
      getJobImportDiff(current, matchedPatch, [company]),
    );
    expect(getJobImportReadiness(current, matchedPatch, matchedFields)).toEqual(
      {
        ready: true,
        missingRequiredFields: [],
        validationIssues: [],
      },
    );
    expect(
      getJobImportReadiness(
        current,
        matchedPatch,
        matchedFields.filter((field) => field !== "title"),
      ),
    ).toEqual({
      ready: false,
      missingRequiredFields: ["求人名"],
      validationIssues: [],
    });
  });

  it("reports salary and recruitment date contradictions before applying", () => {
    const current = {
      ...toJobFormValues(),
      company_id: company.id,
      title: "既存求人",
      salary_max: "500",
      closed_at: "2026-08-01",
    };
    const patch = toJobImportFormPatch(
      {
        ...extracted,
        salary_max: null,
        opened_at: "2026-08-10",
      },
      [company],
    );
    const readiness = getJobImportReadiness(current, patch, [
      "salary_min",
      "opened_at",
    ]);

    expect(readiness.ready).toBe(false);
    expect(readiness.missingRequiredFields).toEqual([]);
    expect(readiness.validationIssues).toEqual([
      "年収上限は年収下限以上にしてください。",
      "募集終了日は募集開始日以降にしてください。",
    ]);
  });

  it("validates text and PDF size before sending", () => {
    expect(validateJobImportSource({ type: "text", text: "短い" })).toContain(
      "20文字",
    );
    expect(
      validateJobImportSource({
        type: "pdf",
        file: new File([new Uint8Array(1)], "job.txt", {
          type: "text/plain",
        }),
      }),
    ).toContain("PDF");
    expect(
      validateJobImportSource({
        type: "pdf",
        file: new File(
          [new Uint8Array(JOB_IMPORT_MAX_PDF_BYTES + 1)],
          "job.pdf",
          { type: "application/pdf" },
        ),
      }),
    ).toContain("5MB");
  });

  it("checks the PDF file signature before AI upload", async () => {
    const validPdf = new File(["%PDF-1.4\nbody\n%%EOF"], "job.pdf", {
      type: "application/pdf",
    });
    const disguisedText = new File(["plain text"], "job.pdf", {
      type: "application/pdf",
    });
    const incompletePdf = new File(["%PDF-1.4\nbody"], "job.pdf", {
      type: "application/pdf",
    });
    const encryptedPdf = new File(
      ["%PDF-1.4\ntrailer << /Encrypt 2 0 R >>\n%%EOF"],
      "protected.pdf",
      { type: "application/pdf" },
    );

    await expect(validateJobImportPdfSignature(validPdf)).resolves.toBeNull();
    await expect(
      validateJobImportPdfSignature(disguisedText),
    ).resolves.toContain("正しいPDF");
    await expect(
      validateJobImportPdfSignature(incompletePdf),
    ).resolves.toContain("読み込みが完了していません");
    await expect(
      validateJobImportPdfSignature(encryptedPdf),
    ).resolves.toContain("パスワード保護");
  });

  it("accepts public HTTPS URLs and rejects unsafe URL forms", () => {
    expect(
      validateJobImportSource({
        type: "url",
        url: "https://careers.example.co.jp/jobs/123",
      }),
    ).toBeNull();
    expect(
      validateJobImportSource({ type: "url", url: "http://localhost/job" }),
    ).toContain("https://");
    expect(
      validateJobImportSource({
        type: "url",
        url: "https://user:password@example.com/job",
      }),
    ).toContain("パスワード");
    expect(
      validateJobImportSource({
        type: "url",
        url: "https://example.com:8443/job",
      }),
    ).toContain("標準");
  });

  it("builds hashed ephemeral source keys without exposing URL values", async () => {
    const source = {
      type: "url" as const,
      url: "https://careers.example.co.jp/jobs/123?ref=agent#details",
    };

    const sourceKey = await getJobImportSourceKey(source);
    const equivalentKey = await getJobImportSourceKey({
      ...source,
      url: "https://careers.example.co.jp/jobs/123?ref=agent",
    });
    expect(sourceKey).toMatch(/^url:sha256:[a-f0-9]{64}$/);
    expect(sourceKey).toBe(equivalentKey);
    expect(sourceKey).not.toContain("careers.example.co.jp");
    expect(sourceKey).not.toContain("ref=agent");
    expect(getJobImportSourceLabel(source)).toBe(
      "公開URL：careers.example.co.jp",
    );
    expect(getJobImportSourceLabel(source)).not.toContain("ref=agent");
    expect(countExtractedJobFields(extracted)).toBe(14);
  });

  it("keys a PDF by the SHA-256 of its bytes, not by its name or size", async () => {
    // The two fixtures share a file name and a byte count on purpose. They
    // stand in for the hardware step this test replaces: a cache keyed on
    // metadata would collide on them and serve a stale extraction.
    const variant = (folder: string) =>
      readFile(
        path.resolve(
          process.cwd(),
          "docs/fixtures",
          folder,
          "job-import-cache-variant.pdf",
        ),
      );
    const [a, b] = await Promise.all([
      variant("cache-variant-a"),
      variant("cache-variant-b"),
    ]);
    const metadata = {
      type: "application/pdf",
      lastModified: 1_786_070_000_000,
    };
    const first = new File([a], "job-import-cache-variant.pdf", metadata);
    const second = new File([b], "job-import-cache-variant.pdf", metadata);

    expect(first.name).toBe(second.name);
    expect(first.size).toBe(second.size);

    const digest = (contents: Buffer) =>
      `pdf:sha256:${createHash("sha256").update(contents).digest("hex")}`;
    const [firstKey, secondKey, renamedKey] = await Promise.all([
      getJobImportSourceKey({ type: "pdf", file: first }),
      getJobImportSourceKey({ type: "pdf", file: second }),
      getJobImportSourceKey({
        type: "pdf",
        file: new File([a], "renamed.pdf", metadata),
      }),
    ]);

    expect(firstKey).toBe(digest(a));
    expect(secondKey).toBe(digest(b));
    expect(firstKey).not.toBe(secondKey);
    // Same bytes under a different name stay one cache entry.
    expect(renamedKey).toBe(firstKey);
  });

  it("distinguishes PDF contents even when file metadata is identical", async () => {
    const metadata = {
      type: "application/pdf",
      lastModified: 1_786_070_000_000,
    };
    const first = new File(["%PDF-first"], "job.pdf", metadata);
    const second = new File(["%PDF-other"], "job.pdf", metadata);

    expect(first.size).toBe(second.size);
    const [firstKey, secondKey] = await Promise.all([
      getJobImportSourceKey({ type: "pdf", file: first }),
      getJobImportSourceKey({ type: "pdf", file: second }),
    ]);
    expect(firstKey).not.toBe(secondKey);
  });
});
