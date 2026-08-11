import { FileText, Sparkles } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/use-auth";
import { CandidateForm } from "@/features/candidates/candidate-form";
import {
  findCandidateDuplicates,
  toCandidateValues,
  type CandidateDuplicateMatch,
  type CandidateFormValues,
} from "@/features/candidates/candidate-form-model";
import { parseCandidateResumeText } from "@/features/candidates/candidate-import-model";
import {
  useCandidatesQuery,
  useCreateCandidateMutation,
} from "@/features/candidates/candidate-queries";
import {
  CANDIDATE_PDF_MAX_BYTES,
  extractCandidatePdfText,
} from "@/services/candidate-document-repository";

export function CandidateResumeImportPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const candidatesQuery = useCandidatesQuery();
  const createMutation = useCreateCandidateMutation();
  const [sourceText, setSourceText] = useState("");
  const [draft, setDraft] = useState<CandidateFormValues | null>(null);
  const [pendingValues, setPendingValues] =
    useState<CandidateFormValues | null>(null);
  const [duplicates, setDuplicates] = useState<CandidateDuplicateMatch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);

  const choosePdf = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setDraft(null);
    setIsExtractingPdf(true);
    try {
      const text = await extractCandidatePdfText(file);
      setSourceText(text);
      setDraft(parseCandidateResumeText(text));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "PDFから文字を抽出できませんでした。",
      );
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const extract = () => {
    setError(null);
    setDuplicates([]);
    setPendingValues(null);
    try {
      setDraft(parseCandidateResumeText(sourceText));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "テキストを読み取れませんでした。",
      );
    }
  };

  const create = async (values: CandidateFormValues) => {
    if (!user) return;
    try {
      const created = await createMutation.mutateAsync({
        ...toCandidateValues(values),
        owner_id: user.id,
      });
      void navigate(`/candidates/${created.id}`, { replace: true });
    } catch {
      // The mutation error is rendered below the review form.
    }
  };

  const submit = async (values: CandidateFormValues) => {
    if (candidatesQuery.isError) {
      setError(
        "既存候補者との重複を確認できませんでした。再読み込みしてから登録してください。",
      );
      return;
    }
    const matches = findCandidateDuplicates(values, candidatesQuery.data ?? []);
    if (matches.length) {
      setDuplicates(matches);
      setPendingValues(values);
      return;
    }
    await create(values);
  };

  return (
    <div className="space-y-4">
      <SectionCard
        description="履歴書PDFや紹介文のテキストから、ラベル付きの項目と連絡先を端末内で抽出します。外部AIへの送信や原文保存は行いません。"
        title="履歴書・テキストから登録"
      >
        <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50">
          <FileText className="size-5 text-blue-700" />
          {isExtractingPdf
            ? "PDFから文字を抽出しています…"
            : "文字入りPDFを選択（最大5MB）"}
          <input
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={isExtractingPdf}
            onChange={(event) =>
              void choosePdf(event.target.files?.[0] ?? null)
            }
            type="file"
          />
        </label>
        <Textarea
          aria-label="候補者情報テキスト"
          className="min-h-56"
          onChange={(event) => {
            setSourceText(event.target.value);
            setDraft(null);
            setError(null);
          }}
          placeholder={
            "例：\n氏名：山田 太郎\nメールアドレス：taro@example.com\n電話番号：090-0000-0000\n現勤務先：〇〇株式会社\n職種：医療機器営業\n希望勤務地：東京都、神奈川県"
          }
          value={sourceText}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <FileText className="size-4" />
            「項目名：内容」の形式は高精度で抽出できます。画像だけのPDFは対象外です。抽出後に必ず確認してください（最大
            {Math.round(CANDIDATE_PDF_MAX_BYTES / 1024 / 1024)}MB）。
          </p>
          <Button
            className="gap-2"
            disabled={!sourceText.trim()}
            onClick={extract}
            size="sm"
          >
            <Sparkles className="size-4" />
            入力候補を作成
          </Button>
        </div>
        {error ? (
          <p
            className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            role="alert"
          >
            {error}
          </p>
        ) : null}
      </SectionCard>

      {draft ? (
        <div>
          <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            抽出結果を下のフォームへ反映しました。空欄や誤認識を修正してから登録してください。貼り付けた原文は保存されません。
          </div>
          {duplicates.length ? (
            <section
              className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-4"
              role="alert"
            >
              <h3 className="text-sm font-semibold text-amber-950">
                既存候補者と一致する情報があります
              </h3>
              <ul className="mt-2 list-disc pl-5 text-sm text-amber-900">
                {duplicates.map(({ candidate, matchedFields }) => (
                  <li key={candidate.id}>
                    {candidate.full_name}（一致：{matchedFields.join("・")}）
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setDuplicates([]);
                    setPendingValues(null);
                  }}
                  size="sm"
                  variant="outline"
                >
                  フォームを見直す
                </Button>
                <Button
                  disabled={!pendingValues || createMutation.isPending}
                  onClick={() => {
                    if (pendingValues) void create(pendingValues);
                  }}
                  size="sm"
                >
                  別人として登録
                </Button>
              </div>
            </section>
          ) : null}
          <CandidateForm
            errorMessage={createMutation.error?.message}
            initialValues={draft}
            isSubmitting={createMutation.isPending || candidatesQuery.isPending}
            onCancel={() => {
              setDraft(null);
              setDuplicates([]);
              setPendingValues(null);
            }}
            onSubmit={submit}
          />
        </div>
      ) : null}
    </div>
  );
}
