import {
  ArrowLeft,
  LoaderCircle,
  MapPin,
  Pencil,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { DefinitionGrid } from "@/components/common/definition-grid";
import { EntityFiles } from "@/components/common/entity-files";
import { EntityTags } from "@/components/common/entity-tags";
import { SectionCard } from "@/components/common/section-card";
import { JobActivityHistory } from "@/components/job/job-activity-history";
import { JobCandidateProposal } from "@/components/job/job-candidate-proposal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { EditorOnly } from "@/features/access/editor-only";
import {
  applicationStatusLabels,
  jobStatusLabels,
} from "@/features/applications/application-model";
import {
  useApplicationsDataQuery,
  useCompaniesQuery,
  useCompanyContactsQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import { useCandidatesQuery } from "@/features/candidates/candidate-queries";
import { formatDate } from "@/lib/format";
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

function salaryLabel(min: number | null, max: number | null) {
  if (min === null && max === null) return "-";
  if (min !== null && max !== null) return `${min}〜${max}万円`;
  return min !== null ? `${min}万円〜` : `〜${max}万円`;
}

export function JobDetailPage() {
  const { jobId = "" } = useParams();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const candidatesQuery = useCandidatesQuery();
  const job = (jobsQuery.data ?? []).find((item) => item.id === jobId);
  const contactsQuery = useCompanyContactsQuery(job?.company_id ?? "");
  const [activeTab, setActiveTab] = useState<JobTab>("概要");
  const [isProposingCandidate, setIsProposingCandidate] = useState(false);
  const isPending =
    jobsQuery.isPending ||
    companiesQuery.isPending ||
    applicationsQuery.isPending ||
    candidatesQuery.isPending;
  const error =
    jobsQuery.error ??
    companiesQuery.error ??
    applicationsQuery.error ??
    candidatesQuery.error;

  if (isPending)
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        求人情報を読み込んでいます…
      </div>
    );
  if (error) return <EmptyState message={error.message} />;
  if (!job) return <EmptyState message="求人が見つかりません" />;

  const company = (companiesQuery.data ?? []).find(
    (item) => item.id === job.company_id,
  );
  const hiringManager = (contactsQuery.data ?? []).find(
    (item) => item.id === job.contact_id,
  );
  const candidates = new Map(
    (candidatesQuery.data ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const jobApplications = (applicationsQuery.data ?? []).filter(
    (application) => application.job_id === job.id,
  );
  const proposedCandidateIds = new Set(
    jobApplications.map((application) => application.candidate_id),
  );
  const suggestedCandidates = (candidatesQuery.data ?? [])
    .filter(
      (candidate) =>
        !proposedCandidateIds.has(candidate.id) &&
        Boolean(job.occupation) &&
        candidate.desired_occupations.some(
          (occupation) =>
            occupation.includes(job.occupation ?? "") ||
            (job.occupation ?? "").includes(occupation),
        ),
    )
    .slice(0, 3);

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
              <Badge value={jobStatusLabels[job.job_status]} />
            </div>
            <p className="mt-1 text-sm font-medium text-slate-700">
              {company?.name ?? "企業未登録"} / {job.division ?? "事業部未登録"}
            </p>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {job.locations.join("、") || "勤務地未登録"}
              </span>
              <span>{salaryLabel(job.salary_min, job.salary_max)}</span>
              <span>採用担当：{hiringManager?.full_name ?? "未設定"}</span>
            </div>
          </div>
          <EditorOnly>
            <div className="flex gap-2">
              <Button
                className="gap-1.5"
                onClick={() => {
                  setActiveTab("候補者");
                  setIsProposingCandidate(true);
                }}
                size="sm"
                variant="outline"
              >
                <UserRound className="size-4" />
                候補者を提案
              </Button>
              <Button
                asChild
                aria-label="求人を編集"
                className="px-2"
                size="sm"
              >
                <Link to={`/jobs/${job.id}/edit`}>
                  <Pencil className="size-4" />
                </Link>
              </Button>
            </div>
          </EditorOnly>
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
      {isProposingCandidate ? (
        <JobCandidateProposal
          applications={applicationsQuery.data ?? []}
          candidates={candidatesQuery.data ?? []}
          jobId={job.id}
          onClose={() => setIsProposingCandidate(false)}
        />
      ) : null}
      <div className="mt-4" role="tabpanel">
        {activeTab === "概要" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="求人概要">
              <DefinitionGrid
                items={[
                  { label: "企業名", value: company?.name ?? "-" },
                  { label: "事業部", value: job.division ?? "-" },
                  { label: "職種", value: job.occupation ?? "-" },
                  { label: "雇用形態", value: job.employment_type ?? "-" },
                  { label: "勤務地", value: job.locations.join("、") || "-" },
                  {
                    label: "年収",
                    value: salaryLabel(job.salary_min, job.salary_max),
                  },
                  {
                    label: "更新日",
                    value: formatDate(job.updated_at.slice(0, 10)),
                  },
                ]}
              />
            </SectionCard>
            <SectionCard title="採用状況">
              <DefinitionGrid
                items={[
                  {
                    label: "募集状況",
                    value: <Badge value={jobStatusLabels[job.job_status]} />,
                  },
                  { label: "選考中人数", value: `${jobApplications.length}名` },
                  {
                    label: "採用担当者",
                    value: hiringManager?.full_name ?? "未設定",
                  },
                  {
                    label: "募集開始日",
                    value: formatDate(job.opened_at ?? "-"),
                  },
                  {
                    label: "募集終了日",
                    value: formatDate(job.closed_at ?? "-"),
                  },
                ]}
              />
            </SectionCard>
            <SectionCard className="xl:col-span-2" title="業務内容・要件">
              <div className="max-w-4xl space-y-4 text-sm leading-7 text-slate-700">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">
                    業務内容
                  </h3>
                  <p className="whitespace-pre-wrap">
                    {job.description ?? "未登録"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">
                    必須要件
                  </h3>
                  <p className="whitespace-pre-wrap">
                    {job.required_conditions ?? "未登録"}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500">
                    歓迎要件
                  </h3>
                  <p className="whitespace-pre-wrap">
                    {job.preferred_conditions ?? "未登録"}
                  </p>
                </div>
              </div>
            </SectionCard>
            <EntityTags
              className="xl:col-span-2"
              label="求人"
              target={{ kind: "job", id: job.id }}
            />
          </div>
        ) : null}
        {activeTab === "候補者" ? (
          <div className="space-y-4">
            <SectionCard
              description="希望職種との一致から抽出"
              title="提案候補"
            >
              {suggestedCandidates.length ? (
                <div className="grid gap-2 md:grid-cols-3">
                  {suggestedCandidates.map((candidate) => (
                    <Link
                      className="rounded-md border border-slate-200 p-3 hover:border-blue-300"
                      key={candidate.id}
                      to={`/candidates/${candidate.id}`}
                    >
                      <p className="font-semibold text-blue-700">
                        {candidate.full_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {candidate.current_occupation ?? "職種未登録"} ・{" "}
                        {candidate.prefecture ?? "居住地未登録"}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState message="条件に合う未提案候補者はいません" />
              )}
            </SectionCard>
            <SectionCard title="提案済み・選考中">
              {jobApplications.length ? (
                <div className="grid gap-2 md:grid-cols-3">
                  {jobApplications.map((application) => {
                    const candidate = candidates.get(application.candidate_id);
                    return (
                      <Link
                        className="rounded-md border border-slate-200 p-3 hover:border-blue-300"
                        key={application.id}
                        to={`/candidates/${application.candidate_id}`}
                      >
                        <div className="flex justify-between gap-2">
                          <p className="font-semibold text-blue-700">
                            {candidate?.full_name ?? "候補者未登録"}
                          </p>
                          <Badge
                            value={
                              applicationStatusLabels[
                                application.application_status
                              ]
                            }
                          />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          次回：{application.next_event ?? "未設定"}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <EmptyState message="提案済み候補者はいません" />
              )}
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
                            to={`/candidates/${application.candidate_id}`}
                          >
                            {candidates.get(application.candidate_id)
                              ?.full_name ?? "候補者未登録"}
                          </Link>
                        </Td>
                        <Td>
                          <Badge
                            value={
                              applicationStatusLabels[
                                application.application_status
                              ]
                            }
                          />
                        </Td>
                        <Td>
                          {application.next_event ?? "-"} ・{" "}
                          {formatDate(
                            (application.next_event_at ?? "-").slice(0, 10),
                          )}
                        </Td>
                        <Td>
                          {formatDate(application.updated_at.slice(0, 10))}
                        </Td>
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
          <JobActivityHistory
            candidates={candidatesQuery.data ?? []}
            jobId={job.id}
          />
        ) : null}
        {activeTab === "ファイル・求人票" ? (
          <EntityFiles target={{ jobId: job.id }} />
        ) : null}
        {activeTab === "メモ" ? (
          <SectionCard title="社内メモ">
            <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {job.internal_notes ?? "メモはありません"}
            </p>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
