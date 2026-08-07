import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { PageIntro } from "@/components/common/page-intro";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  useApplicationsDataQuery,
  useApplicationStatusHistoryQuery,
} from "@/features/applications/application-queries";
import { useCandidatesQuery } from "@/features/candidates/candidate-queries";
import {
  formatReportMonth,
  getReportFunnel,
  getReportMetrics,
  getReportStages,
  type ReportSource,
} from "@/features/reports/report-model";
import { useActivitiesQuery } from "@/features/work/work-queries";
import { getLocalDateString } from "@/lib/format";

export function ReportsPage() {
  const [month, setMonth] = useState(getLocalDateString().slice(0, 7));
  const candidatesQuery = useCandidatesQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const statusHistoryQuery = useApplicationStatusHistoryQuery();
  const activitiesQuery = useActivitiesQuery();
  const source: ReportSource = {
    candidates: candidatesQuery.data ?? [],
    applications: applicationsQuery.data ?? [],
    activities: activitiesQuery.data ?? [],
    applicationStatusHistory: statusHistoryQuery.data ?? [],
  };
  const metrics = getReportMetrics(source, month);
  const stages = getReportStages(source.candidates);
  const funnel = getReportFunnel(source, month);
  const maxStage = Math.max(...stages.map((stage) => stage.value), 1);
  const isLoading = [
    candidatesQuery,
    applicationsQuery,
    statusHistoryQuery,
    activitiesQuery,
  ].some((query) => query.isPending);
  const error = [
    candidatesQuery.error,
    applicationsQuery.error,
    statusHistoryQuery.error,
    activitiesQuery.error,
  ].find(Boolean);

  return (
    <div>
      <PageIntro
        description={`${formatReportMonth(month)}の活動実績と現在の候補者ステージを表示しています。`}
        title="レポート"
        action={
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            集計月
            <Input
              aria-label="レポート集計月"
              className="h-9 w-40 bg-white"
              max={getLocalDateString().slice(0, 7)}
              onChange={(event) => setMonth(event.target.value)}
              type="month"
              value={month}
            />
          </label>
        }
      />

      {isLoading ? (
        <div
          className="flex min-h-48 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600"
          role="status"
        >
          <RefreshCw className="size-4 animate-spin" />
          レポートを集計しています
        </div>
      ) : error ? (
        <div
          className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          role="alert"
        >
          レポートを取得できませんでした。時間を置いて再度お試しください。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            {metrics.map((metric) => (
              <div
                className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                key={metric.label}
              >
                <p className="text-xs text-slate-500">{metric.label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {metric.value}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  前月 {metric.previous}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard
              title="ステージ別人数"
              description="現在の候補者ステータスに基づく人数"
            >
              <div className="space-y-3">
                {stages.map((stage) => (
                  <div
                    className="grid grid-cols-[120px_1fr_32px] items-center gap-3"
                    key={stage.label}
                  >
                    <span className="text-xs text-slate-600">
                      {stage.label}
                    </span>
                    <div
                      aria-label={`${stage.label} ${stage.value}人`}
                      className="h-5 overflow-hidden rounded bg-slate-100"
                      role="img"
                    >
                      <div
                        className="h-full rounded bg-blue-500"
                        style={{ width: `${(stage.value / maxStage) * 100}%` }}
                      />
                    </div>
                    <span className="text-right text-sm font-semibold tabular-nums">
                      {stage.value}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard
              title="月次ファネル"
              description="各段階の発生日・更新日に基づく参考値"
            >
              <TableContainer className="border-0 shadow-none">
                <Table>
                  <thead>
                    <tr>
                      <Th>段階</Th>
                      <Th className="text-right">件数</Th>
                      <Th className="text-right">前段階比</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.map((row) => (
                      <tr key={row.label}>
                        <Td>{row.label}</Td>
                        <Td className="text-right font-semibold">
                          {row.value}
                        </Td>
                        <Td className="text-right">{row.rate}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </SectionCard>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            書類通過と内定は選考ステータス履歴、面接は活動履歴を基準に集計しています。
          </p>
        </>
      )}
    </div>
  );
}
