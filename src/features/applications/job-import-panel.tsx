import { FileText, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent } from "react";

import { AiUsageRemaining } from "@/components/ai/ai-usage-remaining";
import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/features/access/use-access";
import { useAuth } from "@/features/auth/use-auth";
import {
  JOB_IMPORT_MAX_TEXT_LENGTH,
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
  toJobImportFormPatch,
  updateJobImportFieldSelection,
  validateJobImportPdfSignature,
  validateJobImportSource,
  type JobImportResult,
  type JobImportSource,
} from "@/features/applications/job-import-model";
import type { JobFormValues } from "@/features/applications/job-form-model";
import { formatFileSize } from "@/features/files/file-model";
import { isAiUsageExhausted } from "@/features/settings/ai-usage-model";
import {
  aiUsageQueryKeys,
  useAiUsageQuery,
} from "@/features/settings/ai-usage-queries";
import { extractJobPosting } from "@/services/job-import-repository";
import type { CompanyRow } from "@/types/database";

interface JobImportPanelProps {
  companies: CompanyRow[];
  getCurrentValues: () => JobFormValues;
  onApply: (
    result: JobImportResult,
    selectedFields: Array<keyof JobFormValues>,
    resolvedCompanyId?: string,
  ) => void;
}

interface ImportPreviewMeta {
  sourceLabel: string;
  readAt: string;
  reused: boolean;
}

interface ImportCache {
  result: JobImportResult;
  meta: ImportPreviewMeta;
}

const MAX_IMPORT_CACHE_ENTRIES = 3;

const diffKindLabels = {
  add: "追加",
  change: "変更",
  clear: "クリア",
} as const;

export function JobImportPanel({
  companies,
  getCurrentValues,
  onApply,
}: JobImportPanelProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { canWrite } = useAccess();
  const usageQuery = useAiUsageQuery(Boolean(user && canWrite));
  const isQuotaExhausted = isAiUsageExhausted(usageQuery.data, user?.id);
  const [mode, setMode] = useState<"text" | "pdf" | "url">("text");
  const [sourceText, setSourceText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<JobImportResult | null>(null);
  const [previewMeta, setPreviewMeta] = useState<ImportPreviewMeta | null>(
    null,
  );
  const [appliedMessage, setAppliedMessage] = useState<string | null>(null);
  const [selectedFields, setSelectedFields] = useState<
    Array<keyof JobFormValues>
  >([]);
  const [warningsAcknowledged, setWarningsAcknowledged] = useState(false);
  const [acknowledgedUnverifiedKey, setAcknowledgedUnverifiedKey] = useState<
    string | null
  >(null);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [isDraggingPdf, setIsDraggingPdf] = useState(false);
  const [cacheEntryCount, setCacheEntryCount] = useState(0);
  const cacheRef = useRef<Map<string, ImportCache>>(new Map());
  const requestIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baseImportPatch = result
    ? toJobImportFormPatch(result, companies)
    : null;
  const importPatch = baseImportPatch
    ? resolveJobImportCompanyMatch(baseImportPatch, resolvedCompanyId)
    : null;
  const differences = importPatch
    ? getJobImportDiff(getCurrentValues(), importPatch, companies)
    : [];
  const readiness = importPatch
    ? getJobImportReadiness(getCurrentValues(), importPatch, selectedFields)
    : null;
  const unverifiedFields = result
    ? getUnverifiedJobImportFields(result, differences, selectedFields)
    : [];
  const unverifiedKey = unverifiedFields
    .map((difference) => difference.field)
    .sort()
    .join("|");
  const unverifiedAcknowledged =
    !unverifiedKey || acknowledgedUnverifiedKey === unverifiedKey;
  const activeSource: JobImportSource | null =
    mode === "text"
      ? sourceText.trim()
        ? { type: "text", text: sourceText }
        : null
      : mode === "url"
        ? sourceUrl.trim()
          ? { type: "url", url: sourceUrl }
          : null
        : file
          ? { type: "pdf", file }
          : null;
  const sourceValidationError = activeSource
    ? validateJobImportSource(activeSource)
    : null;
  const hasImportSessionData = Boolean(
    sourceText || sourceUrl || file || result || cacheEntryCount,
  );

  const clearPreview = () => {
    requestIdRef.current += 1;
    setError(null);
    setResult(null);
    setPreviewMeta(null);
    setAppliedMessage(null);
    setSelectedFields([]);
    setWarningsAcknowledged(false);
    setAcknowledgedUnverifiedKey(null);
    setResolvedCompanyId(null);
    setIsPending(false);
  };

  const showPreview = (
    nextResult: JobImportResult,
    meta: ImportPreviewMeta,
  ) => {
    const patch = toJobImportFormPatch(nextResult, companies);
    const nextDifferences = getJobImportDiff(
      getCurrentValues(),
      patch,
      companies,
    );
    setResult(nextResult);
    setPreviewMeta(meta);
    setSelectedFields(getRecommendedJobImportFields(nextDifferences));
    setWarningsAcknowledged(false);
    setAcknowledgedUnverifiedKey(null);
    setResolvedCompanyId(null);
    setAppliedMessage(null);
  };

  const selectCompanyMatch = (companyId: string) => {
    if (!baseImportPatch) return;
    const nextPatch = resolveJobImportCompanyMatch(baseImportPatch, companyId);
    if (!nextPatch.matchedCompany) return;
    const nextDifferences = getJobImportDiff(
      getCurrentValues(),
      nextPatch,
      companies,
    );
    const recommended = new Set(getRecommendedJobImportFields(nextDifferences));
    setResolvedCompanyId(companyId);
    setSelectedFields((current) => {
      const retained = new Set([...current, ...recommended]);
      return nextDifferences
        .filter((difference) => retained.has(difference.field))
        .map((difference) => difference.field);
    });
  };

  const clearImportSession = () => {
    clearPreview();
    setIsDraggingPdf(false);
    cacheRef.current.clear();
    setCacheEntryCount(0);
    setSourceText("");
    setSourceUrl("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectPdfFile = (nextFile: File | null) => {
    setFile(nextFile);
    clearPreview();
  };

  const clearPdfFile = () => {
    setFile(null);
    setIsDraggingPdf(false);
    clearPreview();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const dropPdf = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingPdf(false);
    if (isPending) return;
    if (event.dataTransfer.files.length !== 1) {
      clearPdfFile();
      setError("PDFは1件ずつ選択してください。");
      return;
    }
    selectPdfFile(event.dataTransfer.files[0] ?? null);
  };

  const extract = async () => {
    if (isQuotaExhausted) {
      setError(
        "AI利用上限に達しています。利用枠が回復してから再度お試しください。",
      );
      return;
    }
    const source = activeSource;
    if (!source) {
      setError("PDFファイルを選択してください。");
      return;
    }
    const validationError = sourceValidationError;
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setResult(null);
    setPreviewMeta(null);
    setAppliedMessage(null);
    setIsPending(true);
    const requestId = ++requestIdRef.current;

    if (source.type === "pdf") {
      const signatureError = await validateJobImportPdfSignature(source.file);
      if (requestId !== requestIdRef.current) return;
      if (signatureError) {
        setIsPending(false);
        setError(signatureError);
        return;
      }
    }

    let sourceKey: string;
    try {
      sourceKey = await getJobImportSourceKey(source);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setIsPending(false);
      setError(
        "求人票の内容を確認できませんでした。入力元を選び直してください。",
      );
      return;
    }
    if (requestId !== requestIdRef.current) return;
    const cached = cacheRef.current.get(sourceKey);
    if (cached) {
      cacheRef.current.delete(sourceKey);
      cacheRef.current.set(sourceKey, cached);
      setError(null);
      setIsPending(false);
      showPreview(cached.result, {
        ...cached.meta,
        reused: true,
      });
      return;
    }

    const response = await extractJobPosting(source);
    if (requestId !== requestIdRef.current) return;
    setIsPending(false);
    if (response.error) {
      setError(response.error.message);
      return;
    }
    void queryClient.invalidateQueries({ queryKey: aiUsageQueryKeys.all });
    const meta = {
      sourceLabel: getJobImportSourceLabel(source),
      readAt: new Date().toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      reused: false,
    };
    if (cacheRef.current.size >= MAX_IMPORT_CACHE_ENTRIES) {
      const oldestSourceKey = cacheRef.current.keys().next().value;
      if (oldestSourceKey) cacheRef.current.delete(oldestSourceKey);
    }
    cacheRef.current.set(sourceKey, { result: response.data, meta });
    setCacheEntryCount(cacheRef.current.size);
    showPreview(response.data, meta);
  };

  return (
    <SectionCard
      className="mb-4"
      description="求人票の文章、文字入りPDF、公開求人ページから入力候補を抽出します。登録前に必ず内容を確認してください。"
      title="AIで求人情報を取り込む"
    >
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="取り込み方法"
      >
        <Button
          aria-pressed={mode === "text"}
          disabled={isPending}
          onClick={() => {
            setMode("text");
            clearPreview();
          }}
          size="sm"
          type="button"
          variant={mode === "text" ? "default" : "outline"}
        >
          テキストを貼り付け
        </Button>
        <Button
          aria-pressed={mode === "pdf"}
          disabled={isPending}
          onClick={() => {
            setMode("pdf");
            clearPreview();
          }}
          size="sm"
          type="button"
          variant={mode === "pdf" ? "default" : "outline"}
        >
          <FileText className="mr-1.5 size-4" />
          PDFを選択
        </Button>
        <Button
          aria-pressed={mode === "url"}
          disabled={isPending}
          onClick={() => {
            setMode("url");
            clearPreview();
          }}
          size="sm"
          type="button"
          variant={mode === "url" ? "default" : "outline"}
        >
          公開URLを入力
        </Button>
      </div>

      {mode === "text" ? (
        <div className="mt-3">
          <label
            className="block text-xs font-medium text-slate-600"
            htmlFor="job-import-text"
          >
            求人票テキスト
          </label>
          <Textarea
            className="mt-1 min-h-32"
            disabled={isPending}
            id="job-import-text"
            onChange={(event) => {
              setSourceText(event.target.value);
              clearPreview();
            }}
            placeholder="求人ページや求人票の本文をそのまま貼り付けてください。"
            value={sourceText}
          />
          <span className="mt-1 block text-right font-normal text-slate-500">
            {sourceText.trim().length.toLocaleString("ja-JP")} /{" "}
            {JOB_IMPORT_MAX_TEXT_LENGTH.toLocaleString("ja-JP")}文字
          </span>
        </div>
      ) : mode === "pdf" ? (
        <div
          aria-disabled={isPending}
          aria-label="求人票PDFのドロップ領域"
          className={`mt-3 rounded-md border border-dashed p-3 transition-colors ${
            isDraggingPdf
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 bg-slate-50/60"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!isPending) setIsDraggingPdf(true);
          }}
          onDragLeave={() => setIsDraggingPdf(false)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={dropPdf}
          role="group"
        >
          <label
            className="block text-xs font-medium text-slate-600"
            htmlFor="job-import-pdf"
          >
            求人票PDF（5MB以内）
          </label>
          <input
            accept="application/pdf,.pdf"
            className="mt-1 block w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-medium"
            disabled={isPending}
            id="job-import-pdf"
            onChange={(event) => {
              selectPdfFile(event.target.files?.[0] ?? null);
            }}
            ref={fileInputRef}
            type="file"
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            または、この枠内へPDFをドラッグ＆ドロップできます。
          </span>
          {file ? (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <span className="font-normal text-slate-500">
                選択中：{file.name}（{formatFileSize(file.size)}）
              </span>
              <button
                className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isPending}
                onClick={clearPdfFile}
                type="button"
              >
                選択中のPDFを解除
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <label
            className="block text-xs font-medium text-slate-600"
            htmlFor="job-import-url"
          >
            公開求人ページURL
          </label>
          <Input
            className="mt-1"
            disabled={isPending}
            id="job-import-url"
            inputMode="url"
            onChange={(event) => {
              setSourceUrl(event.target.value);
              clearPreview();
            }}
            placeholder="https://example.com/jobs/123"
            type="url"
            value={sourceUrl}
          />
          <span className="mt-1 block font-normal text-slate-500">
            ログイン不要で表示できるHTTPSページに対応します。
          </span>
        </div>
      )}

      {sourceValidationError ? (
        <p className="mt-2 text-xs text-rose-700">{sourceValidationError}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-slate-500">
            元データは自動保存しません。同じ内容の再読取時は、この画面内の結果を再利用します。
          </p>
          {hasImportSessionData && !isPending ? (
            <button
              className="text-xs font-medium text-slate-600 hover:text-slate-900 hover:underline"
              onClick={clearImportSession}
              type="button"
            >
              入力とキャッシュを消去
            </button>
          ) : null}
        </div>
        <Button
          disabled={
            isPending ||
            isQuotaExhausted ||
            !activeSource ||
            Boolean(sourceValidationError)
          }
          onClick={() => void extract()}
          type="button"
        >
          <Sparkles className="mr-1.5 size-4" />
          {isPending ? "AIが読み取り中…" : "AIで読み取る"}
        </Button>
      </div>

      <div className="mt-3">
        <AiUsageRemaining snapshot={usageQuery.data} userId={user?.id} />
      </div>

      {isPending ? (
        <p className="mt-3 text-sm text-blue-700" role="status">
          求人票を読み取っています。完了するまで入力元を変更できません。
        </p>
      ) : null}

      {error ? (
        <p
          className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {appliedMessage ? (
        <p
          className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {appliedMessage}
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-md border border-blue-200 bg-blue-50/50 p-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">読み取り結果</p>
            <p className="mt-1 text-xs text-slate-600">
              {result.company_name ?? "企業名不明"} /{" "}
              {result.title ?? "求人名不明"}
            </p>
            {result.company_industry || result.company_website ? (
              <p className="mt-1 break-all text-xs text-slate-600">
                企業情報候補：業種 {result.company_industry ?? "記載なし"} / Web{" "}
                {result.company_website ?? "記載なし"}
              </p>
            ) : null}
            {importPatch?.companyMatchConflict ? (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                企業照合：企業名とWebサイトが別々の登録済み企業に一致しました。自動反映せず、既存企業を確認してください。
              </p>
            ) : importPatch?.matchedCompany ? (
              <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                企業照合：登録済みの「{importPatch.matchedCompany.name}
                」を企業欄へ反映できます（
                {importPatch.matchedCompanyFields.join("・")}一致）。
              </p>
            ) : result.company_name || result.company_website ? (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                企業照合：企業名・Webサイトが登録済み企業に一致しません。企業欄は変更せず、既存企業を手動で選択してください。
              </p>
            ) : (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                企業照合：企業名を取得できませんでした。企業欄を手動で選択してください。
              </p>
            )}
            {baseImportPatch?.companyMatchConflict ? (
              <div
                aria-label="取り込み企業の候補"
                className="mt-2 rounded border border-amber-200 bg-white p-2"
                role="group"
              >
                <p className="text-xs font-semibold text-slate-800">
                  反映する既存企業を選択
                </p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {baseImportPatch.companyMatchCandidates.map((candidate) => (
                    <button
                      aria-label={`取り込み企業候補「${candidate.company.name}」を選択`}
                      aria-pressed={resolvedCompanyId === candidate.company.id}
                      className={`rounded border p-2 text-left text-xs transition-colors ${
                        resolvedCompanyId === candidate.company.id
                          ? "border-blue-500 bg-blue-50 text-blue-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
                      }`}
                      key={candidate.company.id}
                      onClick={() => selectCompanyMatch(candidate.company.id)}
                      type="button"
                    >
                      <span className="block font-medium">
                        {candidate.company.name}
                      </span>
                      <span className="mt-0.5 block text-[11px]">
                        {candidate.matchedFields.join("・")}一致
                      </span>
                    </button>
                  ))}
                </div>
                {!resolvedCompanyId ? (
                  <p className="mt-2 text-xs text-amber-800">
                    企業を選択するまで入力欄へ反映できません。
                  </p>
                ) : null}
              </div>
            ) : null}
            {readiness?.missingRequiredFields.length === 0 ? (
              <p className="mt-1 rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                必須項目：企業と求人名を確認できます。反映後に内容を確認して登録してください。
              </p>
            ) : readiness ? (
              <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                登録前に入力が必要：
                {readiness.missingRequiredFields.join("、")}
              </p>
            ) : null}
            {readiness?.validationIssues.map((issue) => (
              <p
                className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800"
                key={issue}
              >
                入力内容の確認：{issue}
              </p>
            ))}
            {previewMeta ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span
                  aria-label="読み取り結果の入力元"
                  className="rounded border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700"
                >
                  入力元：{previewMeta.sourceLabel}
                </span>
                <span>
                  {previewMeta.readAt}読取・{countExtractedJobFields(result)}
                  項目を取得
                </span>
              </div>
            ) : null}
            {previewMeta?.reused ? (
              <p className="mt-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                前回の読み取り結果を再利用しました。追加のAI実行は発生していません。
              </p>
            ) : null}
            {result.missing_fields.length ? (
              <p className="mt-1 text-xs text-amber-800">
                未取得：{result.missing_fields.join("、")}
              </p>
            ) : null}
            {result.warnings.map((warning) => (
              <p className="mt-1 text-xs text-amber-800" key={warning}>
                注意：{warning}
              </p>
            ))}
            {result.warnings.length ? (
              <label className="mt-2 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                <input
                  checked={warningsAcknowledged}
                  className="mt-0.5 size-4 rounded border-amber-300 accent-blue-600"
                  onChange={(event) =>
                    setWarningsAcknowledged(event.target.checked)
                  }
                  type="checkbox"
                />
                AIの注意事項を確認しました
              </label>
            ) : null}
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-800">
                  入力欄への変更内容（{differences.length}項目）
                </p>
                {differences.length ? (
                  <div className="flex items-center gap-2">
                    <button
                      className="text-[11px] font-medium text-blue-700 hover:underline"
                      onClick={() =>
                        setSelectedFields(
                          getRecommendedJobImportFields(differences),
                        )
                      }
                      type="button"
                    >
                      推奨だけ選択
                    </button>
                    <button
                      className="text-[11px] font-medium text-blue-700 hover:underline"
                      onClick={() =>
                        setSelectedFields(
                          getEvidenceBackedJobImportFields(result, differences),
                        )
                      }
                      type="button"
                    >
                      根拠ありだけ選択
                    </button>
                    <button
                      className="text-[11px] font-medium text-slate-600 hover:underline"
                      onClick={() =>
                        setSelectedFields(
                          differences.map((difference) => difference.field),
                        )
                      }
                      type="button"
                    >
                      すべて選択
                    </button>
                    <button
                      className="text-[11px] font-medium text-slate-600 hover:underline"
                      onClick={() => setSelectedFields([])}
                      type="button"
                    >
                      すべて解除
                    </button>
                  </div>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                空欄への追加だけを初期選択しています。既存値の変更・クリアは、内容を確認して選択してください。
              </p>
              {differences.some(
                (difference) =>
                  difference.field === "contact_id" &&
                  difference.kind === "clear",
              ) ? (
                <p className="mt-0.5 text-[11px] text-amber-800">
                  企業を変更する場合、以前の企業の採用担当者も同時にクリアします。
                </p>
              ) : null}
            </div>
            {differences.length ? (
              <dl className="divide-y divide-slate-100">
                {differences.map((difference) => (
                  <div
                    className="grid gap-1 px-3 py-2 text-xs md:grid-cols-[1.25rem_9rem_1fr_1fr] md:gap-3"
                    key={difference.field}
                  >
                    <input
                      aria-label={`${difference.label}を反映`}
                      checked={selectedFields.includes(difference.field)}
                      className="mt-0.5 size-4 rounded border-slate-300 accent-blue-600"
                      onChange={(event) =>
                        setSelectedFields((current) =>
                          updateJobImportFieldSelection(
                            current,
                            difference.field,
                            event.target.checked,
                            differences,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    <dt className="font-medium text-slate-700">
                      {difference.label}
                      <span
                        className={
                          difference.kind === "add"
                            ? "ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700"
                            : "ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800"
                        }
                      >
                        {diffKindLabels[difference.kind]}
                      </span>
                    </dt>
                    <dd className="break-words text-slate-500">
                      <span className="mr-1 text-[10px] font-medium text-slate-400">
                        現在
                      </span>
                      {difference.currentValue}
                    </dd>
                    <dd className="break-words font-medium text-slate-800">
                      <span className="mr-1 text-[10px] font-medium text-blue-600">
                        反映後
                      </span>
                      {difference.importedValue}
                      {getJobImportEvidence(result, difference.field).map(
                        (quote) => (
                          <span
                            className="mt-1 block rounded border-l-2 border-blue-200 bg-slate-50 px-2 py-1 text-[11px] font-normal leading-relaxed text-slate-600"
                            key={quote}
                          >
                            <span className="font-medium text-slate-500">
                              根拠：
                            </span>
                            「{quote}」
                          </span>
                        ),
                      )}
                      {difference.field !== "contact_id" &&
                      getJobImportEvidence(result, difference.field).length ===
                        0 ? (
                        <span className="mt-1 block rounded border-l-2 border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-normal text-amber-900">
                          根拠未確認：求人票の原文を直接確認してください
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="px-3 py-4 text-center text-xs text-slate-500">
                入力欄に反映できる新しい内容はありません。
              </p>
            )}
          </div>

          {unverifiedFields.length ? (
            <label className="mt-3 flex items-start gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              <input
                checked={unverifiedAcknowledged}
                className="mt-0.5 size-4 rounded border-amber-300 accent-blue-600"
                onChange={(event) =>
                  setAcknowledgedUnverifiedKey(
                    event.target.checked ? unverifiedKey : null,
                  )
                }
                type="checkbox"
              />
              <span>
                根拠が表示されていない項目（
                {unverifiedFields.map((field) => field.label).join("、")}
                ）を求人票で確認しました
              </span>
            </label>
          ) : null}

          <div className="mt-3 flex justify-end">
            <Button
              disabled={
                !selectedFields.length ||
                (baseImportPatch?.companyMatchConflict && !resolvedCompanyId) ||
                (result.warnings.length > 0 && !warningsAcknowledged) ||
                !unverifiedAcknowledged
              }
              onClick={() => {
                const appliedCount = selectedFields.length;
                const heldCount = Math.max(
                  differences.length - appliedCount,
                  0,
                );
                if (resolvedCompanyId)
                  onApply(result, selectedFields, resolvedCompanyId);
                else onApply(result, selectedFields);
                setResult(null);
                setPreviewMeta(null);
                setSelectedFields([]);
                setWarningsAcknowledged(false);
                setAcknowledgedUnverifiedKey(null);
                setResolvedCompanyId(null);
                setAppliedMessage(
                  `AI抽出結果から${appliedCount}項目を反映しました。${heldCount}項目は反映せず保留しています。求人の登録はまだ完了していません。内容を確認して登録してください。`,
                );
              }}
              size="sm"
              type="button"
            >
              選択した内容を反映（{selectedFields.length}項目）
            </Button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
