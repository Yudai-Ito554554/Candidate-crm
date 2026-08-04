import {
  AlertCircle,
  Check,
  Clock3,
  Eye,
  Inbox,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { PlannedButton } from "@/components/common/planned-button";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  applications,
  candidates,
  getCandidate,
  getJob,
  tasks,
} from "@/data/mock-data";
import {
  inboxMessages,
  recentlyViewedCandidates,
  todaySchedule,
} from "@/data/workspace-data";
import { formatDate } from "@/lib/format";

const attentionGroups = [
  {
    label: "期限超過",
    count: 1,
    candidateId: "c-001",
    detail: "一次面接フィードバック確認",
    tone: "text-rose-700 bg-rose-50",
  },
  {
    label: "候補者返信待ち",
    count: 2,
    candidateId: "c-002",
    detail: "応募意思・面談候補日の回答",
    tone: "text-amber-800 bg-amber-50",
  },
  {
    label: "企業回答待ち",
    count: 2,
    candidateId: "c-001",
    detail: "選考結果と次回面接日程",
    tone: "text-blue-700 bg-blue-50",
  },
  {
    label: "選考結果待ち",
    count: 2,
    candidateId: "c-004",
    detail: "書類選考・一次面接",
    tone: "text-violet-700 bg-violet-50",
  },
  {
    label: "書類待ち",
    count: 1,
    candidateId: "c-003",
    detail: "キャリアシート未受領",
    tone: "text-slate-700 bg-slate-100",
  },
];

const kpis = [
  {
    label: "活動中候補者",
    value: candidates.filter((candidate) => candidate.status !== "入社").length,
  },
  {
    label: "選考中",
    value: applications.filter(
      (application) =>
        !["検討中", "辞退", "見送り", "入社"].includes(application.status),
    ).length,
  },
  { label: "今月の応募", value: 4 },
  {
    label: "今月の内定",
    value: applications.filter((application) => application.status === "内定")
      .length,
  },
];

export function DashboardPage() {
  return (
    <div>
      <PageIntro
        description="優先度と期限を基準に、本日取り組む業務を並べています。"
        title="今日のホーム"
      />

      <SectionCard
        title="今日の対応"
        description={`${todaySchedule.filter((item) => item.status !== "完了").length}件の未完了があります`}
        action={
          <Link
            className="text-xs font-medium text-blue-700 hover:underline"
            to="/today"
          >
            今日の予定を開く
          </Link>
        }
      >
        <TableContainer className="border-0 shadow-none">
          <Table className="min-w-[900px]">
            <thead>
              <tr>
                <Th>時刻・期限</Th>
                <Th>対応種別</Th>
                <Th>候補者名</Th>
                <Th>企業・求人</Th>
                <Th>対応内容</Th>
                <Th>優先度</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {todaySchedule
                .filter((item) => item.status !== "完了")
                .map((item) => {
                  const candidate = item.candidateId
                    ? getCandidate(item.candidateId)
                    : undefined;
                  const job = item.jobId ? getJob(item.jobId) : undefined;
                  return (
                    <tr className="hover:bg-blue-50/40" key={item.id}>
                      <Td
                        className={
                          item.status === "期限超過"
                            ? "font-semibold text-rose-700"
                            : "font-semibold tabular-nums"
                        }
                      >
                        {item.time}
                        {item.status === "期限超過" ? (
                          <span className="ml-2 text-[10px]">期限超過</span>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge value={item.type} />
                      </Td>
                      <Td>
                        {candidate ? (
                          <Link
                            className="font-semibold text-blue-700 hover:underline"
                            to={`/candidates/${candidate.id}`}
                          >
                            {candidate.name}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td className="max-w-56">
                        <p className="truncate font-medium">
                          {job?.company ?? "-"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {job?.title}
                        </p>
                      </Td>
                      <Td className="min-w-56">{item.content}</Td>
                      <Td>
                        <Badge value={item.priority} />
                      </Td>
                      <Td className="text-right">
                        <PlannedButton
                          aria-label={`${item.content}を完了`}
                          className="h-8 gap-1"
                          size="sm"
                          variant="outline"
                        >
                          <Check className="size-3.5" />
                          完了
                        </PlannedButton>
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </Table>
        </TableContainer>
      </SectionCard>

      <SectionCard
        className="mt-4"
        title="要対応"
        description="待ち状態と期限超過を種類別に確認します"
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-5">
          {attentionGroups.map((group) => (
            <Link
              className="rounded-md border border-slate-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
              key={group.label}
              to={`/candidates/${group.candidateId}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${group.tone}`}
                >
                  {group.label}
                </span>
                <span className="text-lg font-semibold tabular-nums">
                  {group.count}
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                {group.detail}
              </p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <SectionCard
          title="最近見た候補者"
          action={<Eye className="size-4 text-slate-400" />}
        >
          <div className="divide-y divide-slate-100">
            {recentlyViewedCandidates.map((recent) => {
              const candidate = getCandidate(recent.candidateId);
              if (!candidate) return null;
              return (
                <Link
                  className="grid grid-cols-[1.2fr_1fr_auto] items-center gap-3 py-2.5 hover:bg-slate-50"
                  key={recent.candidateId}
                  to={`/candidates/${candidate.id}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {candidate.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {candidate.currentRole}
                    </p>
                  </div>
                  <div>
                    <Badge value={candidate.status} />
                    <p className="mt-1 text-xs text-slate-500">
                      次回 {formatDate(candidate.nextContactDate)}
                    </p>
                  </div>
                  <p className="text-right text-[11px] text-slate-400">
                    {recent.viewedAt.replaceAll("-", "/")}
                    <br />
                    に表示
                  </p>
                </Link>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title="最近の活動・受信"
          action={<Inbox className="size-4 text-slate-400" />}
        >
          <div className="divide-y divide-slate-100">
            {inboxMessages.slice(0, 4).map((message) => {
              const candidate = message.candidateId
                ? getCandidate(message.candidateId)
                : undefined;
              return (
                <Link
                  className="flex items-start gap-3 py-2.5 hover:bg-slate-50"
                  key={message.id}
                  to="/inbox"
                >
                  <span className="mt-0.5 rounded-md bg-slate-100 p-1.5">
                    <Clock3 className="size-3.5 text-slate-500" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {message.subject}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {candidate?.name ?? message.sender} ・ {message.preview}
                    </p>
                  </div>
                  <time className="whitespace-nowrap text-[11px] text-slate-400">
                    {message.receivedAt.slice(5).replace("-", "/")}
                  </time>
                </Link>
              );
            })}
          </div>
        </SectionCard>
      </div>

      <section
        aria-label="補助KPI"
        className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <UsersRound className="size-4 text-slate-400" />
          <h2 className="text-xs font-semibold text-slate-600">今月の状況</h2>
        </div>
        <div className="mt-2 grid grid-cols-4 divide-x divide-slate-200">
          {kpis.map((kpi) => (
            <div className="px-4 first:pl-0" key={kpi.label}>
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {tasks.some(
        (task) => task.status !== "完了" && task.dueDate < "2026-08-03",
      ) ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-700">
          <AlertCircle className="size-3.5" />
          期限超過タスクがあります。今日の対応を優先してください。
        </p>
      ) : null}
    </div>
  );
}
