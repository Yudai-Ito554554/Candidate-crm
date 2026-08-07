import {
  ArrowLeft,
  Building2,
  Globe2,
  LoaderCircle,
  Mail,
  MapPin,
  Pencil,
  Phone,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { CompanyActivityHistory } from "@/components/company/company-activity-history";
import { DefinitionGrid } from "@/components/common/definition-grid";
import { EntityFiles } from "@/components/common/entity-files";
import { EntityTags } from "@/components/common/entity-tags";
import { SectionCard } from "@/components/common/section-card";
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
  "採用担当者",
  "求人・選考",
  "活動履歴",
  "ファイル",
  "メモ",
] as const;
type CompanyTab = (typeof tabs)[number];

function formatCapital(value: number | null) {
  if (value === null) return "-";
  if (value >= 100_000_000)
    return `${(value / 100_000_000).toLocaleString("ja-JP")}億円`;
  if (value >= 10_000) return `${(value / 10_000).toLocaleString("ja-JP")}万円`;
  return `${value.toLocaleString("ja-JP")}円`;
}

export function CompanyDetailPage() {
  const { companyId = "" } = useParams();
  const [activeTab, setActiveTab] = useState<CompanyTab>("概要");
  const companiesQuery = useCompaniesQuery();
  const jobsQuery = useJobsQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const candidatesQuery = useCandidatesQuery();
  const contactsQuery = useCompanyContactsQuery(companyId);
  const company = (companiesQuery.data ?? []).find(
    (item) => item.id === companyId,
  );
  const jobs = (jobsQuery.data ?? []).filter(
    (job) => job.company_id === companyId,
  );
  const jobIds = new Set(jobs.map((job) => job.id));
  const applications = (applicationsQuery.data ?? []).filter((application) =>
    jobIds.has(application.job_id),
  );
  const applicationCounts = new Map<string, number>();
  for (const application of applications)
    applicationCounts.set(
      application.job_id,
      (applicationCounts.get(application.job_id) ?? 0) + 1,
    );
  const candidateMap = new Map(
    (candidatesQuery.data ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const jobMap = new Map(jobs.map((job) => [job.id, job]));
  const isPending =
    companiesQuery.isPending ||
    jobsQuery.isPending ||
    applicationsQuery.isPending ||
    candidatesQuery.isPending ||
    contactsQuery.isPending;
  const error =
    companiesQuery.error ??
    jobsQuery.error ??
    applicationsQuery.error ??
    candidatesQuery.error ??
    contactsQuery.error;

  if (isPending)
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        企業情報を読み込んでいます…
      </div>
    );
  if (error) return <EmptyState message={error.message} />;
  if (!company) return <EmptyState message="企業が見つかりません" />;

  return (
    <div>
      <Link
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"
        to="/companies"
      >
        <ArrowLeft className="size-3.5" />
        企業管理へ戻る
      </Link>
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Building2 aria-hidden="true" className="size-5 text-blue-700" />
              <h2 className="text-xl font-semibold text-slate-950">
                {company.name}
              </h2>
              <Badge
                value={
                  company.listed === true
                    ? "上場"
                    : company.listed === false
                      ? "非上場"
                      : "上場区分未設定"
                }
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>{company.industry ?? "業種未登録"}</span>
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5" />
                {company.address ?? "所在地未登録"}
              </span>
              <span>求人 {jobs.length}件</span>
              <span>選考 {applications.length}件</span>
            </div>
          </div>
          <EditorOnly>
            <Button asChild className="gap-1.5" size="sm" variant="outline">
              <Link to={`/companies/${company.id}/edit`}>
                <Pencil aria-hidden="true" className="size-4" />
                編集
              </Link>
            </Button>
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

      <div className="mt-4" role="tabpanel">
        {activeTab === "概要" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard title="企業情報">
              <DefinitionGrid
                items={[
                  { label: "企業名カナ", value: company.name_kana ?? "-" },
                  { label: "業種", value: company.industry ?? "-" },
                  {
                    label: "従業員数",
                    value:
                      company.employees === null
                        ? "-"
                        : `${company.employees.toLocaleString("ja-JP")}名`,
                  },
                  { label: "資本金", value: formatCapital(company.capital) },
                  {
                    label: "上場区分",
                    value:
                      company.listed === null
                        ? "-"
                        : company.listed
                          ? "上場"
                          : "非上場",
                  },
                  { label: "所在地", value: company.address ?? "-" },
                ]}
              />
            </SectionCard>
            <SectionCard title="取引状況">
              <DefinitionGrid
                items={[
                  {
                    label: "採用担当者",
                    value: `${contactsQuery.data?.length ?? 0}名`,
                  },
                  { label: "求人", value: `${jobs.length}件` },
                  {
                    label: "募集中求人",
                    value: `${jobs.filter((job) => job.job_status === "open").length}件`,
                  },
                  { label: "選考中", value: `${applications.length}件` },
                  {
                    label: "最終更新日",
                    value: formatDate(company.updated_at.slice(0, 10)),
                  },
                ]}
              />
            </SectionCard>
            <SectionCard className="xl:col-span-2" title="Webサイト">
              {company.website ? (
                <a
                  className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                  href={company.website}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Globe2 aria-hidden="true" className="size-4" />
                  {company.website}
                </a>
              ) : (
                <p className="text-sm text-slate-500">未登録</p>
              )}
            </SectionCard>
            <EntityTags
              className="xl:col-span-2"
              label="企業"
              target={{ kind: "company", id: company.id }}
            />
          </div>
        ) : null}

        {activeTab === "採用担当者" ? (
          <SectionCard
            action={
              <Button asChild size="sm" variant="outline">
                <Link to={`/companies/${company.id}/edit`}>担当者を管理</Link>
              </Button>
            }
            title="採用担当者"
          >
            {contactsQuery.data?.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {contactsQuery.data.map((contact) => (
                  <article
                    className="rounded-md border border-slate-200 p-3"
                    key={contact.id}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      {contact.full_name ?? "氏名未登録"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[contact.department, contact.position]
                        .filter(Boolean)
                        .join(" / ") || "部署・役職未登録"}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p className="flex items-center gap-1.5">
                        <Mail aria-hidden="true" className="size-3.5" />
                        {contact.email ?? "メール未登録"}
                      </p>
                      <p className="flex items-center gap-1.5">
                        <Phone aria-hidden="true" className="size-3.5" />
                        {contact.phone ?? "電話未登録"}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState message="担当者はまだ登録されていません" />
            )}
          </SectionCard>
        ) : null}

        {activeTab === "求人・選考" ? (
          <div className="space-y-4">
            <SectionCard title="求人">
              {jobs.length ? (
                <TableContainer className="border-0 shadow-none">
                  <Table>
                    <thead>
                      <tr>
                        <Th>求人名</Th>
                        <Th>職種</Th>
                        <Th>勤務地</Th>
                        <Th>募集状況</Th>
                        <Th>選考中</Th>
                        <Th>更新日</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => (
                        <tr key={job.id}>
                          <Td>
                            <Link
                              className="font-semibold text-blue-700 hover:underline"
                              to={`/jobs/${job.id}`}
                            >
                              {job.title}
                            </Link>
                          </Td>
                          <Td>{job.occupation ?? "-"}</Td>
                          <Td>{job.locations.join("、") || "-"}</Td>
                          <Td>
                            <Badge value={jobStatusLabels[job.job_status]} />
                          </Td>
                          <Td>{applicationCounts.get(job.id) ?? 0}名</Td>
                          <Td>{formatDate(job.updated_at.slice(0, 10))}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableContainer>
              ) : (
                <EmptyState message="求人はまだ登録されていません" />
              )}
            </SectionCard>
            <SectionCard title="選考中の候補者">
              {applications.length ? (
                <TableContainer className="border-0 shadow-none">
                  <Table>
                    <thead>
                      <tr>
                        <Th>候補者</Th>
                        <Th>求人</Th>
                        <Th>ステータス</Th>
                        <Th>次回予定</Th>
                        <Th>更新日</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((application) => (
                        <tr key={application.id}>
                          <Td>
                            <Link
                              className="font-semibold text-blue-700 hover:underline"
                              to={`/candidates/${application.candidate_id}`}
                            >
                              {candidateMap.get(application.candidate_id)
                                ?.full_name ?? "候補者未登録"}
                            </Link>
                          </Td>
                          <Td>
                            {jobMap.get(application.job_id)?.title ??
                              "求人未登録"}
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
                          <Td>{application.next_event ?? "-"}</Td>
                          <Td>
                            {formatDate(application.updated_at.slice(0, 10))}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </TableContainer>
              ) : (
                <EmptyState message="選考中の候補者はいません" />
              )}
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "活動履歴" ? (
          <CompanyActivityHistory
            candidates={candidatesQuery.data ?? []}
            companyId={company.id}
            jobs={jobs}
          />
        ) : null}

        {activeTab === "ファイル" ? (
          <EntityFiles target={{ companyId: company.id }} />
        ) : null}

        {activeTab === "メモ" ? (
          <SectionCard title="社内メモ">
            <p className="max-w-3xl whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {company.notes ?? "メモはありません"}
            </p>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
