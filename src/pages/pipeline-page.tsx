import {
  BriefcaseBusiness,
  CalendarClock,
  GripVertical,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/ui/empty-state";
import { PageIntro } from "@/components/common/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAccess } from "@/features/access/use-access";
import {
  useApplicationsQuery,
  useCandidatesQuery,
  useMoveCandidatePipelineMutation,
  useProfilesQuery,
} from "@/features/candidates/candidate-queries";
import { toCandidateView } from "@/features/candidates/candidate-view";
import { formatDate, isOverdueDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { candidateStatusToDatabase } from "@/types/database-status";
import type { CandidateStatus } from "@/types";

type PipelineGroup =
  | "新規"
  | "面談前"
  | "面談済み"
  | "求人提案"
  | "応募調整"
  | "選考中"
  | "内定"
  | "入社"
  | "保留";

const stages: PipelineGroup[] = [
  "新規",
  "面談前",
  "面談済み",
  "求人提案",
  "応募調整",
  "選考中",
  "内定",
  "入社",
  "保留",
];
const dragDataType = "text/candidate-id";
const groupByStatus: Record<CandidateStatus, PipelineGroup> = {
  新規: "新規",
  初回連絡: "面談前",
  面談調整: "面談前",
  面談済み: "面談済み",
  求人提案: "求人提案",
  応募意思確認: "応募調整",
  選考中: "選考中",
  内定: "内定",
  入社: "入社",
  保留: "保留",
  終了: "保留",
};
const statusByGroup: Record<PipelineGroup, CandidateStatus> = {
  新規: "新規",
  面談前: "面談調整",
  面談済み: "面談済み",
  求人提案: "求人提案",
  応募調整: "応募意思確認",
  選考中: "選考中",
  内定: "内定",
  入社: "入社",
  保留: "保留",
};

export function PipelineBoard() {
  const { canWrite } = useAccess();
  const candidatesQuery = useCandidatesQuery();
  const profilesQuery = useProfilesQuery();
  const applicationsQuery = useApplicationsQuery();
  const moveCandidate = useMoveCandidatePipelineMutation();
  const pipelineCandidates = useMemo(
    () =>
      (candidatesQuery.data ?? []).map((candidate) =>
        toCandidateView(
          candidate,
          profilesQuery.data ?? [],
          applicationsQuery.data ?? [],
        ),
      ),
    [applicationsQuery.data, candidatesQuery.data, profilesQuery.data],
  );
  const [dragOverStage, setDragOverStage] = useState<PipelineGroup | null>(
    null,
  );
  const [statusMessage, setStatusMessage] = useState("");
  const canMove = canWrite && !moveCandidate.isPending;
  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    candidateId: string,
  ) => {
    if (!canMove) return;
    event.dataTransfer.setData(dragDataType, candidateId);
    event.dataTransfer.effectAllowed = "move";
  };
  const moveCandidateToStage = (candidateId: string, stage: PipelineGroup) => {
    if (!canMove) return;
    const candidate = pipelineCandidates.find(
      (item) => item.id === candidateId,
    );
    if (!candidate || groupByStatus[candidate.status] === stage) return;

    moveCandidate.mutate(
      {
        candidateId,
        candidateStatus: candidateStatusToDatabase[statusByGroup[stage]],
      },
      {
        onError: () => {
          setStatusMessage(
            `${candidate.name}のステータスを保存できませんでした。元の列へ戻しました。`,
          );
        },
        onSuccess: () => {
          setStatusMessage(`${candidate.name}を「${stage}」へ移動しました。`);
        },
      },
    );
  };
  const handleDrop = (event: DragEvent<HTMLElement>, stage: PipelineGroup) => {
    event.preventDefault();
    setDragOverStage(null);
    moveCandidateToStage(event.dataTransfer.getData(dragDataType), stage);
  };

  if (
    candidatesQuery.isPending ||
    profilesQuery.isPending ||
    applicationsQuery.isPending
  ) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        パイプラインを読み込んでいます…
      </div>
    );
  }

  if (
    candidatesQuery.isError ||
    profilesQuery.isError ||
    applicationsQuery.isError
  ) {
    return (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-center"
        role="alert"
      >
        <p className="text-sm text-rose-700">
          候補者パイプラインを取得できませんでした。
        </p>
        <Button
          className="mt-3"
          onClick={() => {
            void candidatesQuery.refetch();
            void profilesQuery.refetch();
            void applicationsQuery.refetch();
          }}
          size="sm"
          variant="outline"
        >
          再試行
        </Button>
      </div>
    );
  }

  if (pipelineCandidates.length === 0) {
    return <EmptyState message="表示できる候補者がいません" />;
  }

  return (
    <div aria-busy={moveCandidate.isPending}>
      <p aria-live="polite" className="sr-only">
        {statusMessage}
      </p>
      {!canWrite ? (
        <p className="mb-2 text-xs text-slate-500">
          閲覧権限ではパイプラインのステータスを変更できません。
        </p>
      ) : null}
      <div className="overflow-x-auto pb-3">
        <div className="flex min-w-max gap-3">
          {stages.map((stage) => {
            const stageCandidates = pipelineCandidates.filter(
              (candidate) => groupByStatus[candidate.status] === stage,
            );
            return (
              <section
                aria-label={`${stage}列`}
                className={cn(
                  "w-60 shrink-0 rounded-lg border bg-slate-100/70 p-2 transition-colors",
                  dragOverStage === stage
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200",
                )}
                key={stage}
                onDragEnter={() => canMove && setDragOverStage(stage)}
                onDragLeave={(event) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null,
                    )
                  )
                    setDragOverStage(null);
                }}
                onDragOver={(event) => canMove && event.preventDefault()}
                onDrop={(event) => handleDrop(event, stage)}
              >
                <div className="mb-2 flex h-9 items-center justify-between px-1">
                  <Badge value={stage} />
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-slate-200">
                    {stageCandidates.length}
                  </span>
                </div>
                <div className="min-h-28 space-y-2">
                  {stageCandidates.map((candidate) => (
                    <article
                      aria-label={`${candidate.name}の候補者カード`}
                      className={cn(
                        "rounded-md border border-slate-200 bg-white p-3 shadow-sm",
                        canMove && "cursor-grab active:cursor-grabbing",
                      )}
                      draggable={canMove}
                      key={candidate.id}
                      onDragStart={(event) =>
                        handleDragStart(event, candidate.id)
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          className="font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                          to={`/candidates/${candidate.id}`}
                        >
                          {candidate.name}
                        </Link>
                        {canWrite ? (
                          <GripVertical className="size-4 shrink-0 text-slate-300" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs font-medium text-slate-600">
                        {candidate.currentRole}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="size-3" />
                        {candidate.location}
                      </p>
                      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                        <p>最終対応：{formatDate(candidate.lastContactDate)}</p>
                        <p
                          className={
                            isOverdueDate(candidate.nextContactDate)
                              ? "font-semibold text-rose-700"
                              : ""
                          }
                        >
                          <CalendarClock className="mr-1 inline size-3" />
                          次回：{formatDate(candidate.nextContactDate)}
                        </p>
                        <p>
                          <BriefcaseBusiness className="mr-1 inline size-3" />
                          選考中求人 {candidate.activeApplications}件
                        </p>
                      </div>
                      {canWrite ? (
                        <Select
                          aria-label={`${candidate.name}のパイプラインステージ`}
                          className="mt-2 h-8 w-full text-xs"
                          disabled={moveCandidate.isPending}
                          onChange={(event) =>
                            moveCandidateToStage(
                              candidate.id,
                              event.target.value as PipelineGroup,
                            )
                          }
                          value={groupByStatus[candidate.status]}
                        >
                          {stages.map((stageOption) => (
                            <option key={stageOption} value={stageOption}>
                              {stageOption}
                            </option>
                          ))}
                        </Select>
                      ) : null}
                    </article>
                  ))}
                  {stageCandidates.length === 0 ? (
                    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400">
                      カードなし
                    </div>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PipelinePage() {
  return (
    <div>
      <PageIntro
        description="候補者の進捗を確認し、ドラッグ＆ドロップでステータスを更新します。"
        title="候補者パイプライン"
      />
      <PipelineBoard />
    </div>
  );
}
