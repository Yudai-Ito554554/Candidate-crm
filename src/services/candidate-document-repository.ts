import { invoke } from "@tauri-apps/api/core";

export const CANDIDATE_PDF_MAX_BYTES = 5 * 1024 * 1024;

export async function extractCandidatePdfText(file: File): Promise<string> {
  if (
    file.type !== "application/pdf" &&
    !file.name.toLowerCase().endsWith(".pdf")
  )
    throw new Error("PDFファイルを選択してください。");
  if (!file.size || file.size > CANDIDATE_PDF_MAX_BYTES)
    throw new Error("PDFは5MB以内にしてください。");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-")
    throw new Error("正しいPDFファイルを選択してください。");
  try {
    return await invoke<string>("extract_candidate_pdf_text", {
      bytes: Array.from(bytes),
    });
  } catch (caught) {
    throw new Error(
      typeof caught === "string"
        ? caught
        : "PDFから文字を抽出できませんでした。",
      { cause: caught },
    );
  }
}
