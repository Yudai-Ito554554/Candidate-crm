import type { FileCategory } from "@/types/database";

export const MAX_CRM_FILE_SIZE = 10 * 1024 * 1024;

export const allowedCrmFileTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
] as const;

export const acceptedCrmFileTypes = allowedCrmFileTypes.join(",");

export const fileCategoryLabels: Record<FileCategory, string> = {
  resume: "履歴書",
  career_history: "職務経歴書",
  job_description: "求人票",
  application_document: "応募書類",
  certificate: "資格・証明書",
  other: "その他",
};

export const fileCategories = Object.entries(fileCategoryLabels) as [
  FileCategory,
  string,
][];

export type FileTarget =
  { candidateId: string } | { companyId: string } | { jobId: string };

export function validateCrmFile(file: File): string | null {
  if (file.size <= 0) return "空のファイルはアップロードできません。";
  if (file.size > MAX_CRM_FILE_SIZE)
    return "ファイルサイズは10MB以下にしてください。";
  if (!(allowedCrmFileTypes as readonly string[]).includes(file.type))
    return "PDF、Word、JPEG、PNGファイルを選択してください。";
  return null;
}

export function buildStoragePath(
  ownerId: string,
  target: FileTarget,
  file: File,
  uniqueId: string = crypto.randomUUID(),
) {
  const [scope, entityId] =
    "candidateId" in target
      ? ["candidates", target.candidateId]
      : "companyId" in target
        ? ["companies", target.companyId]
        : ["jobs", target.jobId];
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const safeExtension = /^[a-z0-9]{1,10}$/.test(extension)
    ? `.${extension}`
    : "";
  return `${ownerId}/${scope}/${entityId}/${uniqueId}${safeExtension}`;
}

export function formatFileSize(size: number | null) {
  if (size === null) return "-";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
