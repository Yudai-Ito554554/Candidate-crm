import {
  Archive,
  BriefcaseBusiness,
  CheckSquare2,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { EditorOnly } from "@/features/access/editor-only";
import {
  useCompaniesQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import { useProfilesQuery } from "@/features/candidates/candidate-queries";
import { ActivityForm } from "@/features/work/activity-form";
import { activityTypeLabels } from "@/features/work/work-model";
import {
  useArchiveActivityMutation,
  useCandidateActivitiesQuery,
} from "@/features/work/work-queries";
import { getLocalDateString } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActivityRow, ActivityType } from "@/types/database";

type TimelineFilter =
  "すべて" | "メール" | "面談・電話" | "求人・選考" | "タスク・メモ";
const filters: TimelineFilter[] = [
  "すべて",
  "メール",
  "面談・電話",
  "求人・選考",
  "タスク・メモ",
];
function category(type: ActivityType): TimelineFilter {
  if (["email_sent", "email_received"].includes(type)) return "メール";
  if (["interview", "phone", "meeting"].includes(type)) return "面談・電話";
  if (
    [
      "job_proposed",
      "intention_confirmed",
      "application",
      "document_submitted",
      "company_contact",
      "interview_scheduled",
      "selection_result",
    ].includes(type)
  )
    return "求人・選考";
  return "タスク・メモ";
}
function eventIcon(type: ActivityType) {
  if (type.includes("email")) return Mail;
  if (["interview", "meeting", "interview_scheduled"].includes(type))
    return Video;
  if (type === "phone") return Phone;
  if (type === "task") return CheckSquare2;
  if (category(type) === "求人・選考") return BriefcaseBusiness;
  return MessageSquare;
}
function dateLabel(date: string) {
  const today = getLocalDateString();
  const yesterday = getLocalDateString(new Date(Date.now() - 86_400_000));
  if (date === today) return "今日";
  if (date === yesterday) return "昨日";
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function CandidateTimeline({
  candidateId,
  initiallyAdding = false,
}: {
  candidateId: string;
  initiallyAdding?: boolean;
}) {
  const query = useCandidateActivitiesQuery(candidateId);
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const profilesQuery = useProfilesQuery();
  const archiveMutation = useArchiveActivityMutation(candidateId);
  const [filter, setFilter] = useState<TimelineFilter>("すべて");
  const [editing, setEditing] = useState<ActivityRow | "new" | null>(
    initiallyAdding ? "new" : null,
  );
  const jobs = new Map((jobsQuery.data ?? []).map((item) => [item.id, item]));
  const companies = new Map(
    (companiesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const profiles = new Map(
    (profilesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const events = (query.data ?? []).filter(
    (event) => filter === "すべて" || category(event.activity_type) === filter,
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, ActivityRow[]>();
    for (const event of events) {
      const date = event.occurred_at.slice(0, 10);
      groups.set(date, [...(groups.get(date) ?? []), event]);
    }
    return [...groups.entries()];
  }, [events]);
  return (
    <section
      aria-label="候補者タイムライン"
      className="rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">タイムライン</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            活動、メール、選考、タスクを時系列で統合しています
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div
            aria-label="タイムライン絞り込み"
            className="flex flex-wrap gap-1"
            role="group"
          >
            {filters.map((item) => (
              <button
                aria-pressed={filter === item}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-xs font-medium",
                  filter === item
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
                key={item}
                onClick={() => setFilter(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
          <EditorOnly>
            <Button
              aria-label="タイムラインに活動を追加"
              className="gap-1.5"
              onClick={() => setEditing("new")}
              size="sm"
            >
              <Plus className="size-4" />
              活動追加
            </Button>
          </EditorOnly>
        </div>
      </div>
      <div className="space-y-4 p-4">
        {editing ? (
          <ActivityForm
            activity={editing === "new" ? undefined : editing}
            candidateId={candidateId}
            onClose={() => setEditing(null)}
          />
        ) : null}
        {query.isPending ? (
          <p className="py-8 text-center text-sm text-slate-500">
            活動を読み込んでいます…
          </p>
        ) : query.isError ? (
          <EmptyState message={query.error.message} />
        ) : grouped.length ? (
          grouped.map(([date, dateEvents]) => (
            <div className="mb-5 last:mb-0" key={date}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-xs font-semibold text-slate-700">
                  {dateLabel(date)}
                </h3>
                <span className="h-px flex-1 bg-slate-100" />
              </div>
              <ol className="space-y-2">
                {dateEvents.map((event) => {
                  const Icon = eventIcon(event.activity_type);
                  const job = event.job_id ? jobs.get(event.job_id) : undefined;
                  const company = job
                    ? companies.get(job.company_id)
                    : undefined;
                  return (
                    <li
                      className="grid grid-cols-[52px_30px_minmax(0,1fr)] gap-2"
                      key={event.id}
                    >
                      <time className="pt-2 text-xs tabular-nums text-slate-500">
                        {event.occurred_at.slice(11, 16)}
                      </time>
                      <span className="mt-1 flex size-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                        <Icon className="size-3.5" />
                      </span>
                      <article className="rounded-md border border-slate-200 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <Badge
                              value={activityTypeLabels[event.activity_type]}
                            />
                            {event.ai_generated ? (
                              <Badge value="AI生成" />
                            ) : null}
                            <h4 className="truncate text-sm font-semibold text-slate-900">
                              {event.title}
                            </h4>
                          </div>
                          <EditorOnly>
                            <div className="flex gap-1">
                              <Button
                                aria-label={`${event.title}を編集`}
                                onClick={() => setEditing(event)}
                                size="sm"
                                variant="outline"
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                aria-label={`${event.title}をアーカイブ`}
                                className="text-rose-700"
                                disabled={archiveMutation.isPending}
                                onClick={() => archiveMutation.mutate(event.id)}
                                size="sm"
                                variant="outline"
                              >
                                <Archive className="size-3.5" />
                              </Button>
                            </div>
                          </EditorOnly>
                        </div>
                        {event.body ? (
                          <p className="mt-1.5 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {event.body}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-slate-500">
                          <span>
                            担当：
                            {profiles.get(event.owner_id ?? "")?.display_name ??
                              "未設定"}
                          </span>
                          {job ? (
                            <span>
                              関連：{company?.name ?? "企業未登録"} /{" "}
                              {job.title}
                            </span>
                          ) : null}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))
        ) : (
          <EmptyState message={`${filter}の活動はありません`} />
        )}
      </div>
    </section>
  );
}
