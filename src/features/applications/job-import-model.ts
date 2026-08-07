import { z } from "zod";

import {
  companyWebsiteSchema,
  findCompanyDuplicates,
  type CompanyDuplicateMatch,
} from "@/features/applications/company-form-model";
import type { JobFormValues } from "@/features/applications/job-form-model";
import type { CompanyRow } from "@/types/database";

export const JOB_IMPORT_MAX_TEXT_LENGTH = 30_000;
export const JOB_IMPORT_MAX_PDF_BYTES = 5 * 1024 * 1024;
const PDF_TRAILER_SCAN_BYTES = 2_048;

const nullableText = z.string().nullable();
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable();

export const jobImportEvidenceFieldSchema = z.enum([
  "company_name",
  "company_industry",
  "company_website",
  "title",
  "division",
  "occupation",
  "employment_type",
  "locations",
  "salary_min",
  "salary_max",
  "required_conditions",
  "preferred_conditions",
  "description",
  "opened_at",
  "closed_at",
]);

export type JobImportEvidenceField = z.infer<
  typeof jobImportEvidenceFieldSchema
>;

export const jobImportResultSchema = z.object({
  company_name: nullableText,
  company_industry: nullableText,
  company_website: nullableText,
  title: nullableText,
  division: nullableText,
  occupation: nullableText,
  employment_type: nullableText,
  locations: z.array(z.string()),
  salary_min: z.number().int().nonnegative().nullable(),
  salary_max: z.number().int().nonnegative().nullable(),
  required_conditions: nullableText,
  preferred_conditions: nullableText,
  description: nullableText,
  opened_at: nullableDate,
  closed_at: nullableDate,
  warnings: z.array(z.string()),
  missing_fields: z.array(z.string()),
  evidence: z
    .array(
      z.object({
        field: jobImportEvidenceFieldSchema,
        quote: z.string().trim().min(1).max(160),
      }),
    )
    .max(15),
});

export type JobImportResult = z.infer<typeof jobImportResultSchema>;

export interface ImportedCompanyDraft {
  name: string;
  industry: string;
  website: string;
}

export function toImportedCompanyDraft(
  result: JobImportResult,
): ImportedCompanyDraft | null {
  const name = result.company_name?.trim();
  if (!name) return null;
  return {
    name,
    industry: result.company_industry?.trim() ?? "",
    website: result.company_website?.trim() ?? "",
  };
}

export type JobImportSource =
  | { type: "text"; text: string }
  | { type: "pdf"; file: File }
  | { type: "url"; url: string };

function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new Error("File could not be read as binary data."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("File could not be read."));
    reader.readAsArrayBuffer(file);
  });
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function getJobImportSourceKey(
  source: JobImportSource,
): Promise<string> {
  let content: BufferSource;
  if (source.type === "pdf") {
    content = await readFileAsArrayBuffer(source.file);
  } else {
    const normalized =
      source.type === "text"
        ? source.text.trim()
        : (() => {
            const url = new URL(source.url.trim());
            url.hash = "";
            return url.toString();
          })();
    content = new TextEncoder().encode(normalized);
  }
  const digest = await crypto.subtle.digest("SHA-256", content);
  return `${source.type}:sha256:${toHex(new Uint8Array(digest))}`;
}

export function getJobImportSourceLabel(source: JobImportSource): string {
  if (source.type === "text") return "貼り付けテキスト";
  if (source.type === "pdf") return `PDF：${source.file.name}`;
  return `公開URL：${new URL(source.url.trim()).hostname}`;
}

export function countExtractedJobFields(result: JobImportResult): number {
  return [
    result.company_name,
    result.company_industry,
    result.company_website,
    result.title,
    result.division,
    result.occupation,
    result.employment_type,
    result.locations.length ? result.locations : null,
    result.salary_min,
    result.salary_max,
    result.required_conditions,
    result.preferred_conditions,
    result.description,
    result.opened_at,
    result.closed_at,
  ].filter((value) => value !== null && value !== "").length;
}

export function validateJobImportSource(
  source: JobImportSource,
): string | null {
  if (source.type === "text") {
    const length = source.text.trim().length;
    if (length < 20) return "求人票の文章を20文字以上貼り付けてください。";
    if (length > JOB_IMPORT_MAX_TEXT_LENGTH)
      return "貼り付ける文章は30,000文字以内にしてください。";
    return null;
  }

  if (source.type === "url") {
    let url: URL;
    try {
      url = new URL(source.url.trim());
    } catch {
      return "正しい求人ページURLを入力してください。";
    }
    if (url.protocol !== "https:")
      return "https://で始まるURLを入力してください。";
    if (url.username || url.password)
      return "ユーザー名やパスワードを含むURLは使用できません。";
    if (url.port && url.port !== "443")
      return "標準のHTTPSポートを使用するURLだけ取り込めます。";
    return null;
  }

  if (
    source.file.type !== "application/pdf" &&
    !source.file.name.toLowerCase().endsWith(".pdf")
  )
    return "PDFファイルを選択してください。";
  if (source.file.size > JOB_IMPORT_MAX_PDF_BYTES)
    return "PDFは5MB以内にしてください。";
  if (source.file.size === 0) return "空のPDFは読み込めません。";
  return null;
}

export async function validateJobImportPdfSignature(
  file: File,
): Promise<string | null> {
  try {
    const [header, trailer] = await Promise.all([
      readFileAsArrayBuffer(file.slice(0, 5)),
      readFileAsArrayBuffer(
        file.slice(Math.max(0, file.size - PDF_TRAILER_SCAN_BYTES)),
      ),
    ]);
    const signature = String.fromCharCode(...new Uint8Array(header));
    if (signature !== "%PDF-")
      return "PDFの内容を確認できません。正しいPDFファイルを選択してください。";
    const trailerText = new TextDecoder("ascii").decode(trailer);
    if (!trailerText.includes("%%EOF"))
      return "PDFが壊れているか、読み込みが完了していません。別のPDFを選択してください。";
    if (/\/Encrypt\b/.test(trailerText))
      return "パスワード保護されたPDFは読み込めません。保護を解除したPDFを選択してください。";
    return null;
  } catch {
    return "PDFの内容を確認できません。正しいPDFファイルを選択してください。";
  }
}

function text(value: string | null): string {
  return value?.trim() ?? "";
}

export interface JobImportFormPatch {
  values: Partial<JobFormValues>;
  matchedCompany: CompanyRow | null;
  matchedCompanyFields: CompanyDuplicateMatch["matchedFields"];
  companyMatchConflict: boolean;
  companyMatchCandidates: CompanyDuplicateMatch[];
}

export function resolveJobImportCompanyMatch(
  patch: JobImportFormPatch,
  companyId: string | null,
): JobImportFormPatch {
  if (!companyId) return patch;
  const selected = patch.companyMatchCandidates.find(
    (candidate) => candidate.company.id === companyId,
  );
  if (!selected) return patch;
  return {
    ...patch,
    companyMatchConflict: false,
    matchedCompany: selected.company,
    matchedCompanyFields: selected.matchedFields,
    values: {
      ...patch.values,
      company_id: selected.company.id,
      contact_id: "",
    },
  };
}

export type JobImportDiffKind = "add" | "change" | "clear";

export interface JobImportDiff {
  field: keyof JobFormValues;
  label: string;
  currentValue: string;
  importedValue: string;
  kind: JobImportDiffKind;
}

const formFieldEvidenceFields: Partial<
  Record<keyof JobFormValues, JobImportEvidenceField[]>
> = {
  company_id: ["company_name", "company_website"],
  title: ["title"],
  division: ["division"],
  occupation: ["occupation"],
  employment_type: ["employment_type"],
  locations: ["locations"],
  salary_min: ["salary_min"],
  salary_max: ["salary_max"],
  required_conditions: ["required_conditions"],
  preferred_conditions: ["preferred_conditions"],
  description: ["description"],
  opened_at: ["opened_at"],
  closed_at: ["closed_at"],
};

export function getJobImportEvidence(
  result: JobImportResult,
  formField: keyof JobFormValues,
): string[] {
  const evidenceFields = formFieldEvidenceFields[formField] ?? [];
  return [
    ...new Set(
      result.evidence
        .filter((item) => evidenceFields.includes(item.field))
        .map((item) => item.quote),
    ),
  ];
}

export function getUnverifiedJobImportFields(
  result: JobImportResult,
  differences: JobImportDiff[],
  selectedFields: Array<keyof JobFormValues>,
): JobImportDiff[] {
  const selected = new Set(selectedFields);
  return differences.filter(
    (difference) =>
      selected.has(difference.field) &&
      difference.field !== "contact_id" &&
      getJobImportEvidence(result, difference.field).length === 0,
  );
}

export function getEvidenceBackedJobImportFields(
  result: JobImportResult,
  differences: JobImportDiff[],
): Array<keyof JobFormValues> {
  const selected = new Set(
    differences
      .filter(
        (difference) =>
          difference.field !== "contact_id" &&
          getJobImportEvidence(result, difference.field).length > 0,
      )
      .map((difference) => difference.field),
  );
  const clearsContact = differences.some(
    (difference) =>
      difference.field === "contact_id" && difference.kind === "clear",
  );
  if (selected.has("company_id") && clearsContact) selected.add("contact_id");

  return differences
    .filter((difference) => selected.has(difference.field))
    .map((difference) => difference.field);
}

export function getRecommendedJobImportFields(
  differences: JobImportDiff[],
): Array<keyof JobFormValues> {
  return differences
    .filter((difference) => difference.kind === "add")
    .map((difference) => difference.field);
}

export function updateJobImportFieldSelection(
  currentFields: Array<keyof JobFormValues>,
  field: keyof JobFormValues,
  checked: boolean,
  differences: JobImportDiff[],
): Array<keyof JobFormValues> {
  const selected = new Set(currentFields);
  const resetsContact = differences.some(
    (difference) =>
      difference.field === "contact_id" && difference.kind === "clear",
  );

  if (checked) selected.add(field);
  else selected.delete(field);

  if (field === "company_id" && resetsContact) {
    if (checked) selected.add("contact_id");
    else selected.delete("contact_id");
  }
  if (field === "contact_id" && !checked && selected.has("company_id")) {
    selected.delete("company_id");
  }

  return differences
    .filter((difference) => selected.has(difference.field))
    .map((difference) => difference.field);
}

export interface JobImportReadiness {
  ready: boolean;
  missingRequiredFields: string[];
  validationIssues: string[];
}

export function getJobImportReadiness(
  currentValues: JobFormValues,
  patch: JobImportFormPatch,
  selectedFields: Array<keyof JobFormValues>,
): JobImportReadiness {
  const previewValues = { ...currentValues };
  for (const field of selectedFields) {
    const value = patch.values[field];
    if (value !== undefined) Object.assign(previewValues, { [field]: value });
  }

  const missingRequiredFields = [
    ...(previewValues.company_id ? [] : ["企業"]),
    ...(previewValues.title.trim() ? [] : ["求人名"]),
  ];
  const validationIssues = [
    ...(previewValues.salary_min &&
    previewValues.salary_max &&
    Number(previewValues.salary_min) > Number(previewValues.salary_max)
      ? ["年収上限は年収下限以上にしてください。"]
      : []),
    ...(previewValues.opened_at &&
    previewValues.closed_at &&
    previewValues.closed_at < previewValues.opened_at
      ? ["募集終了日は募集開始日以降にしてください。"]
      : []),
  ];
  return {
    ready: missingRequiredFields.length === 0 && validationIssues.length === 0,
    missingRequiredFields,
    validationIssues,
  };
}

const importFieldLabels: Partial<Record<keyof JobFormValues, string>> = {
  company_id: "企業",
  contact_id: "採用担当者",
  title: "求人名",
  division: "事業部",
  occupation: "職種",
  employment_type: "雇用形態",
  locations: "勤務地",
  salary_min: "年収下限",
  salary_max: "年収上限",
  required_conditions: "必須条件",
  preferred_conditions: "歓迎条件",
  description: "仕事内容",
  opened_at: "募集開始日",
  closed_at: "募集終了日",
};

function displayJobImportValue(
  field: keyof JobFormValues,
  value: string,
  companies: CompanyRow[],
) {
  if (!value) return "未入力";
  if (field === "company_id")
    return (
      companies.find((company) => company.id === value)?.name ?? "未登録企業"
    );
  if (field === "contact_id") return "選択済み";
  if (field === "salary_min" || field === "salary_max")
    return `${Number(value).toLocaleString("ja-JP")}万円`;
  return value.length > 160 ? `${value.slice(0, 160)}…` : value;
}

export function getJobImportDiff(
  currentValues: JobFormValues,
  patch: JobImportFormPatch,
  companies: CompanyRow[],
): JobImportDiff[] {
  return Object.entries(patch.values).flatMap(([rawField, rawValue]) => {
    const field = rawField as keyof JobFormValues;
    const importedValue = String(rawValue ?? "");
    const currentValue = currentValues[field];
    if (currentValue === importedValue) return [];
    return [
      {
        field,
        label: importFieldLabels[field] ?? field,
        currentValue: displayJobImportValue(field, currentValue, companies),
        importedValue: displayJobImportValue(field, importedValue, companies),
        kind: !currentValue ? "add" : !importedValue ? "clear" : "change",
      },
    ];
  });
}

export function toJobImportFormPatch(
  result: JobImportResult,
  companies: CompanyRow[],
): JobImportFormPatch {
  const companyName = result.company_name?.trim() ?? "";
  const website = result.company_website?.trim() ?? "";
  const websiteForMatch = companyWebsiteSchema.safeParse(website).success
    ? website
    : "";
  const companyMatches = findCompanyDuplicates(
    { name: companyName, website: websiteForMatch },
    companies,
  );
  const companyMatchConflict = companyMatches.length > 1;
  const matchedCompany = companyMatchConflict
    ? null
    : (companyMatches[0]?.company ?? null);
  const matchedCompanyFields = companyMatchConflict
    ? []
    : (companyMatches[0]?.matchedFields ?? []);

  const values: Partial<JobFormValues> = {
    ...(matchedCompany
      ? { company_id: matchedCompany.id, contact_id: "" }
      : {}),
  };
  const textFields = [
    ["title", result.title],
    ["division", result.division],
    ["occupation", result.occupation],
    ["employment_type", result.employment_type],
    ["required_conditions", result.required_conditions],
    ["preferred_conditions", result.preferred_conditions],
    ["description", result.description],
    ["opened_at", result.opened_at],
    ["closed_at", result.closed_at],
  ] as const;
  for (const [field, imported] of textFields) {
    const importedText = text(imported);
    if (importedText) values[field] = importedText;
  }
  if (result.locations.length)
    values.locations = result.locations
      .map((location) => location.trim())
      .filter(Boolean)
      .join("、");
  if (result.salary_min !== null)
    values.salary_min = result.salary_min.toString();
  if (result.salary_max !== null)
    values.salary_max = result.salary_max.toString();

  return {
    companyMatchCandidates: companyMatches,
    companyMatchConflict,
    matchedCompany,
    matchedCompanyFields,
    values,
  };
}
