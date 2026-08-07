import { Check, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EditorOnly } from "@/features/access/editor-only";
import {
  useCompaniesQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import { useCandidatesQuery } from "@/features/candidates/candidate-queries";
import {
  activityTypeLabels,
  taskPriorityLabels,
  taskTypeLabels,
} from "@/features/work/work-model";
import {
  useActivitiesQuery,
  useCompleteTaskMutation,
  useTasksDataQuery,
} from "@/features/work/work-queries";
import { getLocalDateString } from "@/lib/format";
import { cn } from "@/lib/utils";

export function TodayPage() {
  const tasksQuery = useTasksDataQuery();
  const activitiesQuery = useActivitiesQuery();
  const candidatesQuery = useCandidatesQuery();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const completeMutation = useCompleteTaskMutation();
  const today = getLocalDateString();
  const candidates = new Map(
    (candidatesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const jobs = new Map((jobsQuery.data ?? []).map((item) => [item.id, item]));
  const companies = new Map(
    (companiesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const tasks = (tasksQuery.data ?? []).filter(
    (item) => item.due_at?.slice(0, 10) === today,
  );
  const scheduledActivities = (activitiesQuery.data ?? []).filter(
    (item) =>
      item.occurred_at.slice(0, 10) === today &&
      ["interview", "meeting", "interview_scheduled", "phone"].includes(
        item.activity_type,
      ),
  );
  const items = [
    ...tasks.map((task) => ({
      id: `task-${task.id}`,
      at: task.due_at ?? `${today}T23:59:00`,
      type: taskTypeLabels[task.task_type],
      title: task.title,
      candidateId: task.candidate_id,
      jobId: task.job_id,
      priority: taskPriorityLabels[task.priority],
      completed: Boolean(task.completed_at),
      taskId: task.id,
    })),
    ...scheduledActivities.map((activity) => ({
      id: `activity-${activity.id}`,
      at: activity.occurred_at,
      type: activityTypeLabels[activity.activity_type],
      title: activity.title,
      candidateId: activity.candidate_id,
      jobId: activity.job_id,
      priority: "予定",
      completed: false,
      taskId: null,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const overdue = (tasksQuery.data ?? []).filter(
    (task) =>
      !task.completed_at &&
      Boolean(task.due_at) &&
      task.due_at!.slice(0, 10) < today,
  ).length;
  return (
    <div>
      <PageIntro
        description={`${today.replaceAll("-", "/")}の面談・連絡・期限を時系列で表示します。`}
        title="今日の予定"
      />
      <div className="mb-3 flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <span>
          <strong className="mr-1 text-lg tabular-nums">
            {tasks.filter((item) => !item.completed_at).length +
              scheduledActivities.length}
          </strong>
          未完了・予定
        </span>
        <span className="text-rose-700">
          <strong className="mr-1 text-lg tabular-nums">{overdue}</strong>
          期限超過
        </span>
        <span className="text-emerald-700">
          <strong className="mr-1 text-lg tabular-nums">
            {tasks.filter((item) => item.completed_at).length}
          </strong>
          完了
        </span>
      </div>
      {tasksQuery.isPending || activitiesQuery.isPending ? (
        <p className="py-12 text-center text-sm text-slate-500">
          今日の予定を読み込んでいます…
        </p>
      ) : items.length ? (
        <ol className="rounded-lg border border-slate-200 bg-white shadow-sm">
          {items.map((item, index) => {
            const candidate = item.candidateId
              ? candidates.get(item.candidateId)
              : undefined;
            const job = item.jobId ? jobs.get(item.jobId) : undefined;
            const company = job ? companies.get(job.company_id) : undefined;
            return (
              <li
                className={cn(
                  "grid grid-cols-[72px_18px_minmax(0,1fr)_auto] gap-3 px-4 py-3",
                  index < items.length - 1 && "border-b border-slate-100",
                  item.completed && "bg-slate-50 opacity-70",
                )}
                key={item.id}
              >
                <time className="pt-1 text-sm font-semibold tabular-nums">
                  {item.at.slice(11, 16)}
                </time>
                <div className="relative flex justify-center">
                  <span
                    className={cn(
                      "mt-1.5 size-2.5 rounded-full ring-4",
                      item.completed
                        ? "bg-emerald-500 ring-emerald-50"
                        : "bg-blue-500 ring-blue-50",
                    )}
                  />
                  {index < items.length - 1 ? (
                    <span className="absolute top-5 h-[calc(100%+12px)] w-px bg-slate-200" />
                  ) : null}
                </div>
                <div>
                  <div className="flex gap-2">
                    <Badge value={item.type} />
                    <Badge value={item.completed ? "完了" : item.priority} />
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{item.title}</p>
                  <div className="mt-1 flex gap-2 text-xs">
                    {candidate ? (
                      <Link
                        className="text-blue-700"
                        to={`/candidates/${candidate.id}`}
                      >
                        {candidate.full_name}
                      </Link>
                    ) : null}
                    {job ? (
                      <Link className="text-blue-700" to={`/jobs/${job.id}`}>
                        {company?.name} / {job.title}
                      </Link>
                    ) : null}
                  </div>
                </div>
                {item.taskId && !item.completed ? (
                  <EditorOnly>
                    <Button
                      aria-label={`${item.title}を完了`}
                      className="h-8 gap-1 self-center"
                      onClick={() => completeMutation.complete(item.taskId)}
                      size="sm"
                      variant="outline"
                    >
                      <Check className="size-3.5" />
                      完了
                    </Button>
                  </EditorOnly>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <EmptyState message="今日の予定はありません" />
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Clock3 className="size-3.5" />
        活動予定とタスク期限を統合して表示しています。
      </p>
    </div>
  );
}
