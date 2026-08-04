import {
  ArrowLeft,
  BriefcaseBusiness,
  FileText,
  MapPin,
  Pencil,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DefinitionGrid } from "@/components/common/definition-grid";
import { PlannedButton } from "@/components/common/planned-button";
import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  applications,
  candidates,
  getCandidate,
  getJob,
} from "@/data/mock-data";
import { formatDate, formatSalary } from "@/lib/format";
import { cn } from "@/lib/utils";

const tabs = [
  "概要",
  "候補者",
  "選考中",
  "活動履歴",
  "ファイル・求人票",
  "メモ",
] as const;
type JobTab = (typeof tabs)[number];

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const job = getJob(jobId);
  const [activeTab, setActiveTab] = useState<JobTab>("概要");
  if (!job) return <EmptyState message="求人が見つかりません" />;
  const jobApplications = applications.filter(
    (application) => application.jobId === job.id,
  );
  const proposedCandidates = jobApplications
    .map((application) => getCandidate(application.candidateId))
    .filter((candidate) => candidate !== undefined);
  const suggestedCandidates = candidates
    .filter(
      (candidate) =>
        candidate.desiredRole.includes(job.role) ||
        job.role.includes(candidate.desiredRole),
    )
    .slice(0, 3);
  const hiringManager = job.hiringManager ?? "佐々木 亮（人事部）";

  return (
    <div>
      <Link
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        to="/jobs"
      >
        <ArrowLeft className="size-3.5" />
        求人一覧へ戻る
      </Link>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-950">
                {job.title}
              </h2>
              <Badge value={job.status} />
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {job.company} / {job.division}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {job.location}
              </span>
              <span>{formatSalary(job.salaryMin, job.salaryMax)}</span>
              <span>採用担当：{hiringManager}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <PlannedButton className="gap-1.5" size="sm" variant="outline">
              <UserRound className="size-4" />
              候補者を提案
            </PlannedButton>
            <PlannedButton aria-label="求人を編集" className="px-2" size="sm">
              <Pencil className="size-4" />
            </PlannedButton>
          </div>
        </div>
        <div
          className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2"
          role="tablist"
        >
          {tabs.map((tab) => (
            <button
              aria-selected={activeTab === tab}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                activeTab === tab
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              type="button"
            >
              {tab}
            </button>
          ))}
        </div>
      </section>
      <div className="mt-4" role="tabpanel">
        {activeTab === "概要" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="求人概要">
              <DefinitionGrid
                items={[
                  { label: "企業名", value: job.company },
                  { label: "事業部", value: job.division },
                  { label: "職種", value: job.role },
                  { label: "勤務地", value: job.location },
                  {
                    label: "年収",
                    value: formatSalary(job.salaryMin, job.salaryMax),
                  },
                  { label: "更新日", value: formatDate(job.updatedAt) },
                ]}
              />
            </SectionCard>
            <SectionCard title="採用状況">
              <DefinitionGrid
                items={[
                  { label: "募集状況", value: <Badge value={job.status} /> },
                  { label: "選考中人数", value: `${job.activeCandidates}名` },
                  { label: "採用担当者", value: hiringManager },
                  { label: "採用期限", value: "2026年10月末" },
                ]}
              />
            </SectionCard>
            <SectionCard className="xl:col-span-2" title="業務内容・要件">
              <div className="max-w-4xl space-y-4 text-sm leading-7 text-slate-700">
                <p>
                  医療機関の担当者へ製品・サービスを提案し、導入後の支援まで一貫して担当します。
                </p>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">
                    必須要件
                  </h3>
                  <p>医療業界での実務経験、顧客折衝経験、普通自動車運転免許</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">
                    採用上の留意点
                  </h3>
                  <p>担当エリアと出張頻度を候補者へ事前に説明してください。</p>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}
        {activeTab === "候補者" ? (
          <div className="space-y-4">
            <SectionCard
              title="提案候補"
              description="希望条件と職種経験から抽出"
            >
              <div className="grid gap-2 md:grid-cols-3">
                {suggestedCandidates.map((candidate) => (
                  <Link
                    className="rounded-md border border-slate-200 p-3 hover:border-blue-300"
                    key={candidate.id}
                    to={`/candidates/${candidate.id}`}
                  >
                    <p className="font-semibold text-blue-700">
                      {candidate.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {candidate.currentRole} ・ {candidate.location}
                    </p>
                  </Link>
                ))}
              </div>
            </SectionCard>
            <SectionCard title="提案済み・選考中">
              <div className="grid gap-2 md:grid-cols-3">
                {proposedCandidates.map((candidate) => (
                  <Link
                    className="rounded-md border border-slate-200 p-3 hover:border-blue-300"
                    key={candidate.id}
                    to={`/candidates/${candidate.id}`}
                  >
                    <div className="flex justify-between gap-2">
                      <p className="font-semibold text-blue-700">
                        {candidate.name}
                      </p>
                      <Badge value={candidate.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      次回：{formatDate(candidate.nextContactDate)}
                    </p>
                  </Link>
                ))}
              </div>
            </SectionCard>
          </div>
        ) : null}
        {activeTab === "選考中" ? (
          <SectionCard title="選考中の候補者">
            {jobApplications.length ? (
              <TableContainer className="border-0 shadow-none">
                <Table>
                  <thead>
                    <tr>
                      <Th>候補者名</Th>
                      <Th>ステータス</Th>
                      <Th>次回予定</Th>
                      <Th>更新日</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobApplications.map((application) => (
                      <tr key={application.id}>
                        <Td>
                          <Link
                            className="font-semibold text-blue-700 hover:underline"
                            to={`/candidates/${application.candidateId}`}
                          >
                            {getCandidate(application.candidateId)?.name}
                          </Link>
                        </Td>
                        <Td>
                          <Badge value={application.status} />
                        </Td>
                        <Td>
                          {application.nextStep} ・{" "}
                          {formatDate(application.nextStepDate)}
                        </Td>
                        <Td>{formatDate(application.updatedAt)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            ) : (
              <EmptyState />
            )}
          </SectionCard>
        ) : null}
        {activeTab === "活動履歴" ? (
          <SectionCard title="求人の活動履歴">
            <div className="space-y-3">
              {[
                "採用要件の追加ヒアリング",
                "求人票の年収レンジを更新",
                "候補者3名の進捗を企業へ共有",
              ].map((text, index) => (
                <div
                  className="flex gap-3 border-b border-slate-100 pb-3 text-sm last:border-0"
                  key={text}
                >
                  <BriefcaseBusiness className="size-4 text-blue-600" />
                  <div>
                    <p className="font-medium">{text}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      2026/08/0{3 - index} ・ 伊東 勇大
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        ) : null}
        {activeTab === "ファイル・求人票" ? (
          <SectionCard title="ファイル・求人票">
            <div className="flex items-center gap-3 rounded-md border border-slate-200 p-3">
              <FileText className="size-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">求人票_20260801.pdf</p>
                <p className="text-xs text-slate-500">
                  ダウンロードは次のPhaseで実装予定です
                </p>
              </div>
            </div>
          </SectionCard>
        ) : null}
        {activeTab === "メモ" ? (
          <SectionCard title="社内メモ">
            <p className="max-w-3xl text-sm leading-7 text-slate-700">
              採用担当者との連絡は原則メール。候補者推薦時には転職理由と担当施設の規模を明記する。
            </p>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
