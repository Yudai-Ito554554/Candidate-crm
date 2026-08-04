import {
  BriefcaseBusiness,
  CheckSquare2,
  Mail,
  MessageSquare,
  Phone,
  Paperclip,
  Video,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { getJob } from "@/data/mock-data";
import { getCandidateTimeline } from "@/data/workspace-data";
import { cn } from "@/lib/utils";
import type { TimelineCategory, TimelineEventType } from "@/types";

type TimelineFilter = "すべて" | TimelineCategory;
const filters: TimelineFilter[] = [
  "すべて",
  "メール",
  "面談・電話",
  "求人・選考",
  "タスク・メモ",
];

function eventIcon(type: TimelineEventType) {
  if (type.includes("メール")) return Mail;
  if (type === "Zoom面談" || type === "面接") return Video;
  if (type === "電話") return Phone;
  if (type === "タスク作成") return CheckSquare2;
  if (
    [
      "求人提案",
      "応募意思確認",
      "応募",
      "書類提出",
      "企業確認",
      "選考結果",
    ].includes(type)
  )
    return BriefcaseBusiness;
  return MessageSquare;
}

function dateLabel(date: string) {
  if (date === "2026-08-03") return "今日";
  if (date === "2026-08-02") return "昨日";
  const [year, month, day] = date.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

export function CandidateTimeline({ candidateId }: { candidateId: string }) {
  const [filter, setFilter] = useState<TimelineFilter>("すべて");
  const events = getCandidateTimeline(candidateId).filter(
    (event) => filter === "すべて" || event.category === filter,
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, typeof events>();
    for (const event of events) {
      const date = event.occurredAt.slice(0, 10);
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
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="タイムライン絞り込み"
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
      </div>
      <div className="p-4">
        {grouped.map(([date, dateEvents]) => (
          <div className="mb-5 last:mb-0" key={date}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-xs font-semibold text-slate-700">
                {dateLabel(date)}
              </h3>
              <span className="h-px flex-1 bg-slate-100" />
            </div>
            <ol className="space-y-2">
              {dateEvents.map((event) => {
                const Icon = eventIcon(event.type);
                const job = event.jobId ? getJob(event.jobId) : undefined;
                return (
                  <li
                    className="grid grid-cols-[52px_30px_minmax(0,1fr)] gap-2"
                    key={event.id}
                  >
                    <time className="pt-2 text-xs tabular-nums text-slate-500">
                      {event.occurredAt.slice(11)}
                    </time>
                    <span className="mt-1 flex size-7 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                      <Icon className="size-3.5" />
                    </span>
                    <article className="rounded-md border border-slate-200 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge value={event.type} />
                          <h4 className="truncate text-sm font-semibold text-slate-900">
                            {event.title}
                          </h4>
                        </div>
                        {event.hasAttachment ? (
                          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-500">
                            <Paperclip className="size-3" />
                            添付あり
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-600">
                        {event.content}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span>担当：{event.owner}</span>
                        {job ? (
                          <span>
                            関連：{job.company} / {job.title}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
