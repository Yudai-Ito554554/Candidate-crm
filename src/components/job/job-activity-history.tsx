import { Clock3, Sparkles, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useProfilesQuery } from "@/features/candidates/candidate-queries";
import { activityTypeLabels } from "@/features/work/work-model";
import { useActivitiesQuery } from "@/features/work/work-queries";
import type { CandidateRow } from "@/types/database";

interface JobActivityHistoryProps {
  jobId: string;
  candidates: CandidateRow[];
}

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

export function JobActivityHistory({
  jobId,
  candidates,
}: JobActivityHistoryProps) {
  const activitiesQuery = useActivitiesQuery();
  const profilesQuery = useProfilesQuery();
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  const profileMap = new Map(
    (profilesQuery.data ?? []).map((profile) => [profile.id, profile]),
  );
  const activities = (activitiesQuery.data ?? [])
    .filter((activity) => activity.job_id === jobId)
    .sort(
      (left, right) =>
        new Date(right.occurred_at).getTime() -
        new Date(left.occurred_at).getTime(),
    )
    .slice(0, 30);
  const error = activitiesQuery.error ?? profilesQuery.error;

  return (
    <SectionCard
      description="この求人に紐づく最新30件を新しい順に表示"
      title="求人の活動履歴"
    >
      {activitiesQuery.isPending || profilesQuery.isPending ? (
        <div
          aria-live="polite"
          className="flex min-h-28 items-center justify-center gap-2 text-sm text-slate-500"
        >
          <Clock3 aria-hidden="true" className="size-4 animate-pulse" />
          活動履歴を読み込んでいます…
        </div>
      ) : error ? (
        <EmptyState message={error.message} />
      ) : activities.length ? (
        <ol className="divide-y divide-slate-100">
          {activities.map((activity) => {
            const candidate = activity.candidate_id
              ? candidateMap.get(activity.candidate_id)
              : undefined;
            const owner = activity.owner_id
              ? profileMap.get(activity.owner_id)
              : undefined;

            return (
              <li
                className="grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[10.5rem_minmax(0,1fr)]"
                key={activity.id}
              >
                <time
                  className="text-xs tabular-nums text-slate-500"
                  dateTime={activity.occurred_at}
                >
                  {formatDateTime(activity.occurred_at)}
                </time>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge value={activityTypeLabels[activity.activity_type]} />
                    {activity.ai_generated ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                        <Sparkles aria-hidden="true" className="size-3" />
                        AI生成
                      </span>
                    ) : null}
                    <h3 className="text-sm font-semibold text-slate-900">
                      {activity.title}
                    </h3>
                  </div>
                  {activity.body ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {activity.body}
                    </p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>
                      関連候補者：
                      {candidate ? (
                        <Link
                          className="font-medium text-blue-700 hover:underline"
                          to={`/candidates/${candidate.id}`}
                        >
                          {candidate.full_name}
                        </Link>
                      ) : (
                        "未設定"
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound aria-hidden="true" className="size-3.5" />
                      担当：
                      {owner?.display_name ?? owner?.email ?? "未設定"}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState message="この求人に関連する活動はありません" />
      )}
    </SectionCard>
  );
}
