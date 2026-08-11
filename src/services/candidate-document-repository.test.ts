const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

import {
  CANDIDATE_PDF_MAX_BYTES,
  extractCandidatePdfText,
} from "@/services/candidate-document-repository";

describe("candidate document repository", () => {
  beforeEach(() => invokeMock.mockReset());

  it("PDFをTauriのローカル抽出コマンドへ渡す", async () => {
    invokeMock.mockResolvedValue("氏名：山田 太郎");
    const file = new File(["%PDF-1.4\n%%EOF"], "resume.pdf", {
      type: "application/pdf",
    });

    await expect(extractCandidatePdfText(file)).resolves.toBe(
      "氏名：山田 太郎",
    );
    expect(invokeMock).toHaveBeenCalledOnce();
    const call = invokeMock.mock.calls[0] as unknown as [
      string,
      { bytes: number[] },
    ];
    expect(call[0]).toBe("extract_candidate_pdf_text");
    expect(call[1].bytes.slice(0, 5)).toEqual([37, 80, 68, 70, 45]);
  });

  it("PDF以外と上限超過をTauriへ渡す前に拒否する", async () => {
    await expect(
      extractCandidatePdfText(new File(["text"], "resume.txt")),
    ).rejects.toThrow("PDFファイルを選択してください。");
    await expect(
      extractCandidatePdfText(
        new File([new Uint8Array(CANDIDATE_PDF_MAX_BYTES + 1)], "large.pdf", {
          type: "application/pdf",
        }),
      ),
    ).rejects.toThrow("PDFは5MB以内にしてください。");
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
