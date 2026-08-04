import {
  BriefcaseBusiness,
  CalendarClock,
  GripVertical,
  MapPin,
} from "lucide-react";
import { useState, type DragEvent } from "react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { Badge } from "@/components/ui/badge";
import { candidates as initialCandidates } from "@/data/mock-data";
import { formatDate, mockToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Candidate, CandidateStatus } from "@/types";

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
  const [pipelineCandidates, setPipelineCandidates] =
    useState<Candidate[]>(initialCandidates);
  const [dragOverStage, setDragOverStage] = useState<PipelineGroup | null>(
    null,
  );
  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    candidateId: string,
  ) => {
    event.dataTransfer.setData(dragDataType, candidateId);
    event.dataTransfer.effectAllowed = "move";
  };
  const handleDrop = (event: DragEvent<HTMLElement>, stage: PipelineGroup) => {
    event.preventDefault();
    const candidateId = event.dataTransfer.getData(dragDataType);
    if (candidateId)
      setPipelineCandidates((items) =>
        items.map((candidate) =>
          candidate.id === candidateId
            ? { ...candidate, status: statusByGroup[stage] }
            : candidate,
        ),
      );
    setDragOverStage(null);
  };

  return (
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
              onDragEnter={() => setDragOverStage(stage)}
              onDragLeave={(event) => {
                if (
                  !event.currentTarget.contains(
                    event.relatedTarget as Node | null,
                  )
                )
                  setDragOverStage(null);
              }}
              onDragOver={(event) => event.preventDefault()}
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
                    className="cursor-grab rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing"
                    draggable
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
                      <GripVertical className="size-4 shrink-0 text-slate-300" />
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
                          candidate.nextContactDate <= mockToday
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
  );
}

export function PipelinePage() {
  return (
    <div>
      <PageIntro
        description="候補者画面内のパイプライン表示へ移動しました。"
        title="候補者パイプライン"
      />
      <PipelineBoard />
    </div>
  );
}
