import {
  Bot,
  Check,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

import { AiUsageRemaining } from "@/components/ai/ai-usage-remaining";
import { EditorOnly } from "@/features/access/editor-only";
import { useAuth } from "@/features/auth/use-auth";
import {
  useCandidateAiSummariesQuery,
  useGenerateCandidateSummaryMutation,
  useReviewAiSummaryMutation,
} from "@/features/ai/ai-summary-queries";
import { useProfilesQuery } from "@/features/candidates/candidate-queries";
import { isAiUsageExhausted } from "@/features/settings/ai-usage-model";
import { useAiUsageQuery } from "@/features/settings/ai-usage-queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function GenerationConfirmation({
  isQuotaExhausted,
  isPending,
  onCancel,
  onConfirm,
}: {
  isQuotaExhausted: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <section
      aria-describedby="ai-generation-confirmation-description"
      aria-labelledby="ai-generation-confirmation-title"
      className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3"
      role="alertdialog"
    >
      <h2
        className="text-sm font-semibold text-amber-950"
        id="ai-generation-confirmation-title"
      >
        AIサマリーを生成しますか？
      </h2>
      <p
        className="mt-1 text-xs leading-5 text-amber-800"
        id="ai-generation-confirmation-description"
      >
        候補者の業務情報をOpenAIへ送信します。API利用料金が発生し、生成結果は担当者による確認が必要です。
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          disabled={isPending || isQuotaExhausted}
          onClick={onConfirm}
          size="sm"
          type="button"
        >
          {isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="size-4" />
          )}
          {isPending ? "生成中…" : "料金を確認して生成する"}
        </Button>
        <Button
          disabled={isPending}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="outline"
        >
          キャンセル
        </Button>
      </div>
    </section>
  );
}

export function CandidateAi({ candidateId }: { candidateId: string }) {
  const [isGenerationConfirmationOpen, setGenerationConfirmationOpen] =
    useState(false);
  const { user } = useAuth();
  const summariesQuery = useCandidateAiSummariesQuery(candidateId);
  const profilesQuery = useProfilesQuery();
  const currentProfile = (profilesQuery.data ?? []).find(
    (profile) => profile.id === user?.id,
  );
  const canGenerate =
    currentProfile?.role === "admin" || currentProfile?.role === "agent";
  const usageQuery = useAiUsageQuery(Boolean(user && canGenerate));
  const isQuotaExhausted = isAiUsageExhausted(usageQuery.data, user?.id);
  const reviewMutation = useReviewAiSummaryMutation(candidateId);
  const generateMutation = useGenerateCandidateSummaryMutation(candidateId);
  const summary = summariesQuery.data?.[0];
  const reviewer = summary?.reviewed_by
    ? (profilesQuery.data ?? []).find(
        (profile) => profile.id === summary.reviewed_by,
      )
    : undefined;
  const error = summariesQuery.error ?? profilesQuery.error;

  if (summariesQuery.isPending || profilesQuery.isPending)
    return (
      <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500">
        <Clock3 aria-hidden="true" className="size-4 animate-pulse" />
        AIサマリーを読み込んでいます…
      </div>
    );
  if (error) return <EmptyState message={error.message} />;
  if (!summary)
    return (
      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-800">
          <span className="flex items-start gap-2">
            <Bot aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            AI生成はサーバー側Edge
            Functionで実行します。生成内容は担当者の確認が必要です。
          </span>
          <EditorOnly>
            <Button
              className="gap-1.5"
              disabled={generateMutation.isPending || isQuotaExhausted}
              onClick={() => setGenerationConfirmationOpen(true)}
              size="sm"
              type="button"
            >
              {generateMutation.isPending ? (
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
              ) : (
                <Sparkles aria-hidden="true" className="size-4" />
              )}
              {generateMutation.isPending ? "生成中…" : "AIサマリーを生成"}
            </Button>
          </EditorOnly>
        </div>
        {isGenerationConfirmationOpen ? (
          <GenerationConfirmation
            isQuotaExhausted={isQuotaExhausted}
            isPending={generateMutation.isPending}
            onCancel={() => setGenerationConfirmationOpen(false)}
            onConfirm={() => {
              generateMutation.mutate();
              setGenerationConfirmationOpen(false);
            }}
          />
        ) : null}
        <div className="mb-3">
          <AiUsageRemaining snapshot={usageQuery.data} userId={user?.id} />
        </div>
        {generateMutation.error ? (
          <p className="mb-3 text-sm text-rose-700" role="alert">
            {generateMutation.error.message}
          </p>
        ) : null}
        <EmptyState message="この候補者のAIサマリーはまだ生成されていません" />
      </div>
    );

  const cards = [
    { title: "候補者サマリー", content: summary.candidate_summary },
    { title: "転職理由の整理", content: summary.change_reason_summary },
    { title: "強み", content: summary.strengths },
    { title: "懸念点", content: summary.concerns },
    { title: "面談で確認すべきこと", content: summary.interview_questions },
    { title: "推奨求人", content: summary.recommended_jobs },
    { title: "次回アクション", content: summary.next_action },
  ];

  return (
    <div>
      <section className="mb-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Bot aria-hidden="true" className="size-4 text-violet-700" />
              <p className="text-sm font-semibold text-violet-950">
                AI生成サマリー
              </p>
              <Badge className="bg-violet-100 text-violet-800 ring-violet-600/20">
                AI生成
              </Badge>
              {summary.reviewed_at ? (
                <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                  確認済み
                </Badge>
              ) : (
                <Badge value="未確認" />
              )}
            </div>
            <p className="mt-1 text-xs text-violet-800">
              生成日時：{formatDateTime(summary.generated_at)} ・ モデル：
              {summary.model} ・ プロンプト：{summary.prompt_version}
            </p>
            {summary.source_activity_through_at ? (
              <p className="mt-0.5 text-xs text-violet-700">
                参照活動：
                {formatDateTime(summary.source_activity_through_at)}まで
              </p>
            ) : null}
            {summary.reviewed_at ? (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-emerald-800">
                <ShieldCheck aria-hidden="true" className="size-3.5" />
                {reviewer?.display_name ?? reviewer?.email ?? "担当者"}が
                {formatDateTime(summary.reviewed_at)}に確認
              </p>
            ) : null}
          </div>
          <EditorOnly>
            <div className="flex flex-wrap gap-2">
              <Button
                className="gap-1.5"
                disabled={generateMutation.isPending || isQuotaExhausted}
                onClick={() => setGenerationConfirmationOpen(true)}
                size="sm"
                type="button"
                variant="outline"
              >
                {generateMutation.isPending ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <Sparkles aria-hidden="true" className="size-4" />
                )}
                {generateMutation.isPending ? "生成中…" : "再生成"}
              </Button>
              {!summary.reviewed_at && user ? (
                <Button
                  className="gap-1.5"
                  disabled={reviewMutation.isPending}
                  onClick={() =>
                    reviewMutation.mutate({
                      summaryId: summary.id,
                      reviewerId: user.id,
                    })
                  }
                  size="sm"
                  type="button"
                >
                  <Check aria-hidden="true" className="size-4" />
                  内容を確認済みにする
                </Button>
              ) : null}
            </div>
          </EditorOnly>
        </div>
        {isGenerationConfirmationOpen ? (
          <div className="mt-3">
            <GenerationConfirmation
              isQuotaExhausted={isQuotaExhausted}
              isPending={generateMutation.isPending}
              onCancel={() => setGenerationConfirmationOpen(false)}
              onConfirm={() => {
                generateMutation.mutate();
                setGenerationConfirmationOpen(false);
              }}
            />
          </div>
        ) : null}
        <div className="mt-2">
          <AiUsageRemaining snapshot={usageQuery.data} userId={user?.id} />
        </div>
        <p className="mt-2 text-xs leading-5 text-violet-700">
          AI出力は補助情報です。候補者への送信や求人提案前に、必ず担当者が根拠情報と内容を確認してください。
        </p>
        {reviewMutation.error || generateMutation.error ? (
          <p className="mt-2 text-sm text-rose-700" role="alert">
            {(reviewMutation.error ?? generateMutation.error)?.message}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {cards.map((card) => (
          <section
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={card.title}
          >
            <h2 className="text-sm font-semibold text-slate-900">
              {card.title}
            </h2>
            <p className="mt-3 max-w-2xl whitespace-pre-line text-sm leading-6 text-slate-600">
              {card.content ?? "情報なし"}
            </p>
          </section>
        ))}
      </div>
    </div>
  );
}
