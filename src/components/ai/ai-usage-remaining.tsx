import { Gauge } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  aiUsageLevelLabels,
  getAiUsageResumeAt,
  getAiUsageLevel,
  type AiUsageLevel,
  type AiUsageSnapshot,
} from "@/features/settings/ai-usage-model";
import { cn } from "@/lib/utils";

const levelPriority: Record<AiUsageLevel, number> = {
  normal: 0,
  warning: 1,
  critical: 2,
  exhausted: 3,
};

function highestLevel(hourly: AiUsageLevel, daily: AiUsageLevel) {
  return levelPriority[hourly] >= levelPriority[daily] ? hourly : daily;
}

function formatRecoveryTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AiUsageRemaining({
  snapshot,
  userId,
}: {
  snapshot: AiUsageSnapshot | undefined;
  userId: string | undefined;
}) {
  if (!snapshot || !userId) return null;
  const usage = snapshot.byUser.find((row) => row.userId === userId);
  const hourlyUsed = usage?.lastHour ?? 0;
  const dailyUsed = usage?.last24Hours ?? 0;
  const hourlyRemaining = Math.max(snapshot.limits.hourly - hourlyUsed, 0);
  const dailyRemaining = Math.max(snapshot.limits.daily - dailyUsed, 0);
  const level = highestLevel(
    getAiUsageLevel(hourlyUsed, snapshot.limits.hourly),
    getAiUsageLevel(dailyUsed, snapshot.limits.daily),
  );
  const resumeAt = getAiUsageResumeAt(snapshot, userId);

  return (
    <div
      aria-label="AI利用残り枠"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700",
        level !== "normal" && "border-amber-200 bg-amber-50 text-amber-900",
        level === "exhausted" && "border-rose-200 bg-rose-50 text-rose-900",
      )}
      role="status"
    >
      <span className="inline-flex items-center gap-1.5 font-medium">
        <Gauge aria-hidden="true" className="size-3.5" />
        AI利用残り枠
      </span>
      <span className="tabular-nums">1時間：{hourlyRemaining}回</span>
      <span className="tabular-nums">24時間：{dailyRemaining}回</span>
      <Badge value={aiUsageLevelLabels[level]} />
      {level === "exhausted" ? (
        <span className="w-full font-medium sm:w-auto">
          {resumeAt
            ? `利用再開見込み：${formatRecoveryTime(resumeAt)}`
            : "利用枠が回復すると再実行できます。"}
        </span>
      ) : null}
    </div>
  );
}
