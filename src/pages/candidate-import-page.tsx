import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { CandidateCsvImportPanel } from "@/features/candidates/candidate-csv-import-panel";
import { CandidateResumeImportPanel } from "@/features/candidates/candidate-resume-import-panel";
import { cn } from "@/lib/utils";

export function CandidateImportPage() {
  const [mode, setMode] = useState<"csv" | "resume">("csv");
  return (
    <div>
      <Link
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        to="/candidates"
      >
        <ArrowLeft className="size-3.5" />
        候補者一覧へ戻る
      </Link>
      <PageIntro
        description="大量の候補者データや履歴書テキストを、確認してから安全に登録します。"
        title="候補者データ取り込み"
      />
      <div
        className="mb-4 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm"
        role="tablist"
        aria-label="候補者データの取り込み方法"
      >
        <button
          aria-selected={mode === "csv"}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
            mode === "csv"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
          onClick={() => setMode("csv")}
          role="tab"
          type="button"
        >
          <FileSpreadsheet className="size-4" />
          CSV一括登録
        </button>
        <button
          aria-selected={mode === "resume"}
          className={cn(
            "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
            mode === "resume"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
          onClick={() => setMode("resume")}
          role="tab"
          type="button"
        >
          <FileText className="size-4" />
          履歴書・テキスト
        </button>
      </div>
      {mode === "csv" ? (
        <CandidateCsvImportPanel />
      ) : (
        <CandidateResumeImportPanel />
      )}
    </div>
  );
}
