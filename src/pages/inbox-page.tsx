import { Bot, Mail, MailOpen, Reply } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { PlannedButton } from "@/components/common/planned-button";
import { Badge } from "@/components/ui/badge";
import { getCandidate, getJob } from "@/data/mock-data";
import { inboxMessages } from "@/data/workspace-data";
import { cn } from "@/lib/utils";
import type { InboxCategory } from "@/types";

const categories: InboxCategory[] = [
  "未対応",
  "候補者から",
  "企業から",
  "返信待ち",
  "対応済み",
];

export function InboxPage() {
  const [category, setCategory] = useState<InboxCategory>("未対応");
  const filtered = useMemo(
    () => inboxMessages.filter((message) => message.category === category),
    [category],
  );
  const [selectedId, setSelectedId] = useState(inboxMessages[0]?.id ?? "");
  const selected =
    filtered.find((message) => message.id === selectedId) ?? filtered[0];

  return (
    <div>
      <PageIntro
        description="候補者と企業からの連絡を、業務対象に紐づけて確認します。"
        title="Inbox"
      />
      <div className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        {categories.map((item) => (
          <button
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
              {
                inboxMessages.filter((message) => message.category === item)
                  .length
              }
            </span>
          </button>
        ))}
      </div>

      <div className="grid min-h-[600px] grid-cols-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid-cols-[minmax(420px,0.9fr)_1.1fr]">
        <section
          aria-label="メール一覧"
          className="border-b border-slate-200 lg:border-b-0 lg:border-r"
        >
          <div className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
            {category}・{filtered.length}件
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((message) => {
              const candidate = message.candidateId
                ? getCandidate(message.candidateId)
                : undefined;
              const job = message.jobId ? getJob(message.jobId) : undefined;
              return (
                <button
                  className={cn(
                    "block w-full px-4 py-3 text-left hover:bg-slate-50",
                    selected?.id === message.id && "bg-blue-50",
                  )}
                  key={message.id}
                  onClick={() => setSelectedId(message.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {message.sender}
                    </p>
                    <time className="whitespace-nowrap text-[11px] text-slate-400">
                      {message.receivedAt.slice(5).replace("-", "/")}
                    </time>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-slate-700">
                    {message.subject}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                    {message.preview}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge value={message.responseStatus} />
                    {candidate ? (
                      <span className="text-[11px] text-blue-700">
                        {candidate.name}
                      </span>
                    ) : null}
                    {job ? (
                      <span className="max-w-40 truncate text-[11px] text-slate-500">
                        {job.company}
                      </span>
                    ) : null}
                    {message.hasAiDraft ? (
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
        </section>

        <section aria-label="メール内容" className="min-w-0">
          {selected ? (
            <>
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-slate-500">{selected.sender}</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-950">
                      {selected.subject}
                    </h2>
                  </div>
                  <Badge value={selected.responseStatus} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  {selected.candidateId ? (
                    <Link
                      className="text-blue-700 hover:underline"
                      to={`/candidates/${selected.candidateId}`}
                    >
                      候補者：{getCandidate(selected.candidateId)?.name}
                    </Link>
                  ) : null}
                  {selected.jobId ? (
                    <Link
                      className="text-blue-700 hover:underline"
                      to={`/jobs/${selected.jobId}`}
                    >
                      求人：{getJob(selected.jobId)?.title}
                    </Link>
                  ) : null}
                  <span>{selected.receivedAt.replaceAll("-", "/")}</span>
                </div>
              </div>
              <div className="p-5">
                <div className="max-w-2xl whitespace-pre-line text-sm leading-7 text-slate-700">
                  {selected.body}
                </div>
              </div>
              <div className="border-t border-slate-100 p-4">
                <div className="flex flex-wrap gap-2">
                  <PlannedButton className="gap-1.5" size="sm">
                    <Reply className="size-4" />
                    返信を作成
                  </PlannedButton>
                  <PlannedButton
                    className="gap-1.5"
                    size="sm"
                    variant="outline"
                  >
                    <Bot className="size-4" />
                    AI下書き
                  </PlannedButton>
                  <PlannedButton
                    className="gap-1.5"
                    size="sm"
                    variant="outline"
                  >
                    <MailOpen className="size-4" />
                    対応済みにする
                  </PlannedButton>
                </div>
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
