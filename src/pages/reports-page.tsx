import { PageIntro } from "@/components/common/page-intro";
import { SectionCard } from "@/components/common/section-card";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";

const reportMetrics = [
  { label: "新規候補者", value: 18, previous: 14 },
  { label: "面談", value: 12, previous: 10 },
  { label: "求人提案", value: 28, previous: 24 },
  { label: "応募", value: 9, previous: 7 },
  { label: "書類通過", value: 6, previous: 5 },
  { label: "面接", value: 5, previous: 4 },
  { label: "内定", value: 2, previous: 1 },
  { label: "入社", value: 1, previous: 1 },
];

const stages = [
  { label: "新規・初回連絡", value: 2 },
  { label: "面談前", value: 1 },
  { label: "面談済み", value: 2 },
  { label: "求人提案", value: 1 },
  { label: "応募調整", value: 1 },
  { label: "選考中", value: 1 },
  { label: "内定", value: 1 },
  { label: "入社", value: 0 },
  { label: "保留", value: 1 },
];

export function ReportsPage() {
  const maxStage = Math.max(...stages.map((stage) => stage.value), 1);
  return (
    <div>
      <PageIntro
        description="2026年8月の活動実績を仮データで表示しています。"
        title="レポート"
      />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {reportMetrics.map((metric) => (
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
        <SectionCard title="ステージ別人数">
          <div className="space-y-3">
            {stages.map((stage) => (
              <div
                className="grid grid-cols-[120px_1fr_32px] items-center gap-3"
                key={stage.label}
              >
                <span className="text-xs text-slate-600">{stage.label}</span>
                <div className="h-5 overflow-hidden rounded bg-slate-100">
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
        <SectionCard title="月次ファネル">
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
                {[
                  { label: "求人提案", value: 28, rate: "-" },
                  { label: "応募", value: 9, rate: "32%" },
                  { label: "書類通過", value: 6, rate: "67%" },
                  { label: "面接", value: 5, rate: "83%" },
                  { label: "内定", value: 2, rate: "40%" },
                ].map((row) => (
                  <tr key={row.label}>
                    <Td>{row.label}</Td>
                    <Td className="text-right font-semibold">{row.value}</Td>
                    <Td className="text-right">{row.rate}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableContainer>
        </SectionCard>
      </div>
    </div>
  );
}
