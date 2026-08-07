import {
  MAX_CRM_FILE_SIZE,
  buildStoragePath,
  formatFileSize,
  validateCrmFile,
} from "@/features/files/file-model";

describe("file model", () => {
  it("builds a storage path without exposing the original file name", () => {
    const file = new File(["resume"], "佐藤 健太 履歴書.pdf", {
      type: "application/pdf",
    });

    const path = buildStoragePath(
      "user-1",
      { candidateId: "candidate-1" },
      file,
      "file-id",
    );

    expect(path).toBe("user-1/candidates/candidate-1/file-id.pdf");
    expect(path).not.toContain("佐藤");
  });

  it("builds an isolated company storage path", () => {
    const file = new File(["contract"], "取引基本契約書.pdf", {
      type: "application/pdf",
    });

    expect(
      buildStoragePath("user-1", { companyId: "company-1" }, file, "file-id"),
    ).toBe("user-1/companies/company-1/file-id.pdf");
  });

  it("rejects unsupported and oversized files", () => {
    expect(
      validateCrmFile(new File(["text"], "memo.txt", { type: "text/plain" })),
    ).toMatch(/PDF/);
    expect(
      validateCrmFile(
        new File([new Uint8Array(MAX_CRM_FILE_SIZE + 1)], "large.pdf", {
          type: "application/pdf",
        }),
      ),
    ).toMatch(/10MB/);
  });

  it("formats file sizes for business UI", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1_572_864)).toBe("1.5 MB");
  });
});
