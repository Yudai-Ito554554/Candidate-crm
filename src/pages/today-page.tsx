import { Check, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { PlannedButton } from "@/components/common/planned-button";
import { Badge } from "@/components/ui/badge";
import { getCandidate, getJob } from "@/data/mock-data";
import { todaySchedule } from "@/data/workspace-data";
import { cn } from "@/lib/utils";

export function TodayPage() {
  return (
    <div>
      <PageIntro
        description="2026年8月3日（月）の面談・連絡・期限を時系列で表示します。"
        title="今日の予定"
      />
      <div className="mb-3 flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <span>
          <strong className="mr-1 text-lg tabular-nums">
            {todaySchedule.filter((item) => item.status === "未完了").length}
          </strong>
          未完了
        </span>
        <span className="text-rose-700">
          <strong className="mr-1 text-lg tabular-nums">
            {todaySchedule.filter((item) => item.status === "期限超過").length}
          </strong>
          期限超過
        </span>
        <span className="text-emerald-700">
          <strong className="mr-1 text-lg tabular-nums">
            {todaySchedule.filter((item) => item.status === "完了").length}
          </strong>
          完了
        </span>
      </div>
      <ol className="rounded-lg border border-slate-200 bg-white shadow-sm">
        {todaySchedule.map((item, index) => {
          const candidate = item.candidateId
            ? getCandidate(item.candidateId)
            : undefined;
          const job = item.jobId ? getJob(item.jobId) : undefined;
          return (
            <li
              className={cn(
                "grid grid-cols-[72px_18px_minmax(0,1fr)_auto] gap-3 px-4 py-3",
                index < todaySchedule.length - 1 && "border-b border-slate-100",
                item.status === "完了" && "bg-slate-50 opacity-70",
              )}
              key={item.id}
            >
              <time
                className={cn(
                  "pt-1 text-sm font-semibold tabular-nums",
                  item.status === "期限超過" && "text-rose-700",
                )}
              >
                {item.time}
              </time>
              <div className="relative flex justify-center">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 rounded-full ring-4",
                    item.status === "完了"
                      ? "bg-emerald-500 ring-emerald-50"
                      : item.status === "期限超過"
                        ? "bg-rose-500 ring-rose-50"
                        : "bg-blue-500 ring-blue-50",
                  )}
                />
                {index < todaySchedule.length - 1 ? (
                  <span className="absolute top-5 h-[calc(100%+12px)] w-px bg-slate-200" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={item.type} />
                  <Badge value={item.status} />
                  <Badge value={item.priority} />
                </div>
                <p className="mt-1.5 text-sm font-medium text-slate-900">
                  {item.content}
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                  {candidate ? (
                    <Link
                      className="text-blue-700 hover:underline"
                      to={`/candidates/${candidate.id}`}
                    >
                      {candidate.name}
                    </Link>
                  ) : null}
                  {job ? (
                    <Link
                      className="truncate text-blue-700 hover:underline"
                      to={`/jobs/${job.id}`}
                    >
                      {job.company} / {job.title}
                    </Link>
                  ) : null}
                </div>
              </div>
              <PlannedButton
                aria-label={`${item.content}を完了`}
                className="h-8 gap-1 self-center"
                size="sm"
                variant="outline"
              >
                <Check className="size-3.5" />
                完了
              </PlannedButton>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock3 className="size-3.5" />
        予定の編集と完了状態の保存は次のPhaseで実装予定です。
      </p>
    </div>
  );
}
