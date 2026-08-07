import {
  AlertCircle,
  Check,
  Clock3,
  Inbox,
  RefreshCw,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { EditorOnly } from "@/features/access/editor-only";
import {
  useApplicationsDataQuery,
  useCompaniesQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import {
  useCandidatesQuery,
  useCandidateViewsQuery,
} from "@/features/candidates/candidate-queries";
import {
  getDashboardActions,
  getDashboardAttention,
  getDashboardKpis,
  getRecentCandidates,
  getRecentFeed,
  type DashboardSource,
} from "@/features/dashboard/dashboard-model";
import { useEmailThreadsQuery } from "@/features/inbox/inbox-queries";
import {
  useActivitiesQuery,
  useCompleteTaskMutation,
  useTasksDataQuery,
} from "@/features/work/work-queries";
import { formatDate, getLocalDateString } from "@/lib/format";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function DashboardPage() {
  const candidatesQuery = useCandidatesQuery();
  const candidateViewsQuery = useCandidateViewsQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const activitiesQuery = useActivitiesQuery();
  const tasksQuery = useTasksDataQuery();
  const emailThreadsQuery = useEmailThreadsQuery();
  const completeTask = useCompleteTaskMutation();
  const queries = [
    candidatesQuery,
    candidateViewsQuery,
    applicationsQuery,
    jobsQuery,
    companiesQuery,
    activitiesQuery,
    tasksQuery,
    emailThreadsQuery,
  ];
  const source: DashboardSource = {
    candidates: candidatesQuery.data ?? [],
    applications: applicationsQuery.data ?? [],
    jobs: jobsQuery.data ?? [],
    companies: companiesQuery.data ?? [],
    activities: activitiesQuery.data ?? [],
    tasks: tasksQuery.data ?? [],
    emailThreads: emailThreadsQuery.data ?? [],
    candidateViews: candidateViewsQuery.data ?? [],
  };
  const today = getLocalDateString();
  const actions = getDashboardActions(source, today);
  const attention = getDashboardAttention(source, today);
  const recentCandidates = getRecentCandidates(
    source.candidates,
    source.candidateViews,
  );
  const recentFeed = getRecentFeed(source);
  const kpis = getDashboardKpis(source, today);
  const isLoading = queries.some((query) => query.isPending);
  const error = queries.find((query) => query.error)?.error;
  const hasOverdue = attention[0]?.count > 0;

  return (
    <div>
      <PageIntro
        description="候補者・選考・タスク・Inboxの最新情報から、今日の優先業務を集約しています。"
        title="今日のホーム"
      />

      {isLoading ? (
        <div
          className="flex min-h-48 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600"
          role="status"
        >
          <RefreshCw className="size-4 animate-spin" />
          ホームの情報を読み込んでいます
        </div>
      ) : error ? (
        <div
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          role="alert"
        >
          ホームの情報を取得できませんでした。時間を置いて再度お試しください。
        </div>
      ) : (
        <>
          <SectionCard
            title="今日の対応"
            description={`${actions.length}件の対応・予定があります`}
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
                  {actions.map((action) => (
                    <tr
                      className="hover:bg-blue-50/40"
                      key={`${action.source}-${action.id}`}
                    >
                      <Td
                        className={
                          action.overdue
                            ? "font-semibold text-rose-700"
                            : "font-semibold tabular-nums"
                        }
                      >
                        {action.timeLabel}
                        {action.overdue ? (
                          <span className="ml-2 text-[10px]">期限超過</span>
                        ) : null}
                      </Td>
                      <Td>
                        <Badge value={action.type} />
                      </Td>
                      <Td>
                        {action.candidateId ? (
                          <Link
                            className="font-semibold text-blue-700 hover:underline"
                            to={`/candidates/${action.candidateId}`}
                          >
                            {action.candidateName}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td className="max-w-56">
                        <p className="truncate font-medium">
                          {action.companyName}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {action.jobTitle}
                        </p>
                      </Td>
                      <Td className="min-w-56">{action.title}</Td>
                      <Td>
                        <Badge value={action.priority} />
                      </Td>
                      <Td className="text-right">
                        {action.source === "task" ? (
                          <EditorOnly>
                            <Button
                              aria-label={`${action.title}を完了`}
                              className="h-8 gap-1"
                              disabled={completeTask.isPending}
                              onClick={() => completeTask.complete(action.id)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              <Check className="size-3.5" />
                              完了
                            </Button>
                          </EditorOnly>
                        ) : (
                          <span className="text-xs text-slate-400">予定</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                  {actions.length === 0 ? (
                    <tr>
                      <Td
                        className="py-8 text-center text-slate-500"
                        colSpan={7}
                      >
                        今日の対応はありません。
                      </Td>
                    </tr>
                  ) : null}
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
              {attention.map((group) => (
                <Link
                  className="rounded-md border border-slate-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50/30"
                  key={group.label}
                  to={group.to}
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
              description="このアカウントで候補者詳細を開いた順"
              action={<UsersRound className="size-4 text-slate-400" />}
            >
              <div className="divide-y divide-slate-100">
                {recentCandidates.map((candidate) => (
                  <Link
                    className="grid grid-cols-[1.2fr_1fr_auto] items-center gap-3 py-2.5 hover:bg-slate-50"
                    key={candidate.id}
                    to={`/candidates/${candidate.id}`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {candidate.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {candidate.occupation}
                      </p>
                    </div>
                    <div>
                      <Badge value={candidate.status} />
                      <p className="mt-1 text-xs text-slate-500">
                        次回{" "}
                        {candidate.nextActionDate
                          ? formatDate(
                              getLocalDateString(
                                new Date(candidate.nextActionDate),
                              ),
                            )
                          : "未設定"}
                      </p>
                    </div>
                    <p className="text-right text-[11px] text-slate-400">
                      {formatDateTime(candidate.viewedAt)}
                      <br />
                      閲覧
                    </p>
                  </Link>
                ))}
                {recentCandidates.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    閲覧履歴はまだありません。
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="最近の活動・受信"
              action={<Inbox className="size-4 text-slate-400" />}
            >
              <div className="divide-y divide-slate-100">
                {recentFeed.map((item) => (
                  <Link
                    className="flex items-start gap-3 py-2.5 hover:bg-slate-50"
                    key={item.id}
                    to={item.to}
                  >
                    <span className="mt-0.5 rounded-md bg-slate-100 p-1.5">
                      <Clock3 className="size-3.5 text-slate-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {item.detail}
                      </p>
                    </div>
                    <time className="whitespace-nowrap text-[11px] text-slate-400">
                      {formatDateTime(item.occurredAt)}
                    </time>
                  </Link>
                ))}
                {recentFeed.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">
                    活動・受信履歴はありません。
                  </p>
                ) : null}
              </div>
            </SectionCard>
          </div>

          <section
            aria-label="補助KPI"
            className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <UsersRound className="size-4 text-slate-400" />
              <h2 className="text-xs font-semibold text-slate-600">
                今月の状況
              </h2>
            </div>
            <div className="mt-2 grid grid-cols-2 divide-x divide-slate-200 md:grid-cols-4">
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

          {hasOverdue ? (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-rose-700">
              <AlertCircle className="size-3.5" />
              期限超過タスクがあります。今日の対応を優先してください。
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
