import { Bot, Clock3, Mail, MailOpen } from "lucide-react";
import { useState } from "react";
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
  emailParticipantLabels,
  emailThreadStatusLabels,
  filterInboxThreads,
  inboxCategories,
  inboxCategoryCount,
  type InboxCategory,
} from "@/features/inbox/inbox-model";
import {
  useEmailMessagesQuery,
  useEmailThreadsQuery,
  useUpdateEmailThreadStatusMutation,
} from "@/features/inbox/inbox-queries";
import { cn } from "@/lib/utils";
import type { EmailThreadStatus } from "@/types/database";

function formatEmailDate(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function InboxPage() {
  const threadsQuery = useEmailThreadsQuery();
  const candidatesQuery = useCandidatesQuery();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const statusMutation = useUpdateEmailThreadStatusMutation();
  const [category, setCategory] = useState<InboxCategory>("未対応");
  const [selectedId, setSelectedId] = useState("");
  const threads = threadsQuery.data ?? [];
  const filtered = filterInboxThreads(threads, category);
  const selected =
    filtered.find((thread) => thread.id === selectedId) ?? filtered[0];
  const messagesQuery = useEmailMessagesQuery(selected?.id ?? "");
  const candidates = new Map(
    (candidatesQuery.data ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const jobs = new Map((jobsQuery.data ?? []).map((job) => [job.id, job]));
  const companies = new Map(
    (companiesQuery.data ?? []).map((company) => [company.id, company]),
  );

  function changeStatus(status: EmailThreadStatus) {
    if (!selected) return;
    statusMutation.mutate({ threadId: selected.id, status });
  }

  return (
    <div>
      <PageIntro
        description="候補者と企業からの連絡を、業務対象に紐づけて確認します。"
        title="Inbox"
      />
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        {inboxCategories.map((item) => (
          <button
            aria-pressed={category === item}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
              category === item
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
            key={item}
            onClick={() => setCategory(item)}
            type="button"
          >
            {item}
            <span className="ml-1.5 text-xs opacity-70">
              {inboxCategoryCount(threads, item)}
            </span>
          </button>
        ))}
      </div>

      <div className="grid min-h-[600px] grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(400px,0.9fr)_1.1fr]">
        <section
          aria-label="メール一覧"
          className="border-b border-slate-200 lg:border-b-0 lg:border-r"
        >
          <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
            {category}・{filtered.length}件
          </div>
          {threadsQuery.isPending ? (
            <p className="py-12 text-center text-sm text-slate-500">
              メールを読み込んでいます…
            </p>
          ) : threadsQuery.isError ? (
            <div className="p-4">
              <EmptyState message={threadsQuery.error.message} />
            </div>
          ) : filtered.length ? (
            <div className="divide-y divide-slate-100">
              {filtered.map((thread) => {
                const candidate = thread.candidate_id
                  ? candidates.get(thread.candidate_id)
                  : undefined;
                const job = thread.job_id ? jobs.get(thread.job_id) : undefined;
                const company = thread.company_id
                  ? companies.get(thread.company_id)
                  : job
                    ? companies.get(job.company_id)
                    : undefined;
                return (
                  <button
                    aria-pressed={selected?.id === thread.id}
                    className={cn(
                      "block w-full px-4 py-3 text-left hover:bg-slate-50",
                      selected?.id === thread.id && "bg-blue-50",
                    )}
                    key={thread.id}
                    onClick={() => setSelectedId(thread.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {thread.last_sender_name ?? "送信者未取得"}
                      </p>
                      <time className="whitespace-nowrap text-[11px] text-slate-400">
                        {formatEmailDate(thread.last_message_at)}
                      </time>
                    </div>
                    <p className="mt-1 truncate text-sm font-medium text-slate-700">
                      {thread.subject}
                    </p>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                      {thread.last_message_preview ?? "本文プレビューなし"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge value={emailThreadStatusLabels[thread.status]} />
                      <span className="text-[11px] text-slate-500">
                        {emailParticipantLabels[thread.participant_type]}
                      </span>
                      {candidate ? (
                        <span className="text-[11px] text-blue-700">
                          {candidate.full_name}
                        </span>
                      ) : null}
                      {company ? (
                        <span className="max-w-40 truncate text-[11px] text-slate-500">
                          {company.name}
                        </span>
                      ) : null}
                      {thread.has_ai_draft ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-violet-700">
                          <Bot className="size-3" />
                          AI下書きあり
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4">
              <EmptyState message={`${category}のメールはありません`} />
            </div>
          )}
        </section>

        <section aria-label="メール内容" className="min-w-0">
          {selected ? (
            <>
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">
                      {selected.last_sender_name ?? "送信者未取得"}
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-slate-950">
                      {selected.subject}
                    </h2>
                  </div>
                  <Badge value={emailThreadStatusLabels[selected.status]} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {selected.candidate_id ? (
                    <Link
                      className="text-blue-700 hover:underline"
                      to={`/candidates/${selected.candidate_id}`}
                    >
                      候補者：
                      {candidates.get(selected.candidate_id)?.full_name ??
                        "未登録"}
                    </Link>
                  ) : null}
                  {selected.job_id ? (
                    <Link
                      className="text-blue-700 hover:underline"
                      to={`/jobs/${selected.job_id}`}
                    >
                      求人：{jobs.get(selected.job_id)?.title ?? "未登録"}
                    </Link>
                  ) : null}
                  <span>{formatEmailDate(selected.last_message_at)}</span>
                </div>
              </div>

              <div className="max-h-[430px] space-y-3 overflow-y-auto p-5">
                {messagesQuery.isPending ? (
                  <p className="py-10 text-center text-sm text-slate-500">
                    本文を読み込んでいます…
                  </p>
                ) : messagesQuery.isError ? (
                  <EmptyState message={messagesQuery.error.message} />
                ) : messagesQuery.data.length ? (
                  messagesQuery.data.map((message) => (
                    <article
                      className={cn(
                        "max-w-2xl rounded-lg border p-4",
                        message.direction === "outbound"
                          ? "ml-auto border-blue-100 bg-blue-50/60"
                          : "border-slate-200 bg-white",
                      )}
                      key={message.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {message.sender_name ?? message.sender_email} ・
                          {message.sender_email}
                        </span>
                        <time>{formatEmailDate(message.sent_at)}</time>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {message.body_text}
                      </p>
                      <div className="mt-2 flex gap-2 text-[11px] text-slate-500">
                        {message.has_attachments ? <span>添付あり</span> : null}
                        {message.ai_generated ? <span>AI生成</span> : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <EmptyState message="メール本文はまだ同期されていません" />
                )}
              </div>

              <div className="border-t border-slate-100 p-4">
                {statusMutation.isError ? (
                  <p className="mb-2 text-sm text-rose-700" role="alert">
                    {statusMutation.error.message}
                  </p>
                ) : null}
                <EditorOnly>
                  <div className="flex flex-wrap gap-2">
                    {selected.status !== "waiting_reply" ? (
                      <Button
                        className="gap-1.5"
                        disabled={statusMutation.isPending}
                        onClick={() => changeStatus("waiting_reply")}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        <Clock3 className="size-4" />
                        返信待ちにする
                      </Button>
                    ) : null}
                    <Button
                      className="gap-1.5"
                      disabled={statusMutation.isPending}
                      onClick={() =>
                        changeStatus(
                          selected.status === "handled"
                            ? "unhandled"
                            : "handled",
                        )
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <MailOpen className="size-4" />
                      {selected.status === "handled"
                        ? "未対応に戻す"
                        : "対応済みにする"}
                    </Button>
                  </div>
                </EditorOnly>
              </div>
            </>
          ) : (
            <div className="flex h-full min-h-72 flex-col items-center justify-center text-sm text-slate-500">
              <Mail className="mb-2 size-7 text-slate-300" />
              メールを選択してください
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
