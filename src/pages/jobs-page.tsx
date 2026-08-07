import {
  Archive,
  Building2,
  List,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { ArchivedJobs } from "@/components/job/archived-jobs";
import { EditorOnly } from "@/features/access/editor-only";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  applicationStatusLabels,
  jobStatusLabels,
} from "@/features/applications/application-model";
import {
  useApplicationsDataQuery,
  useCompaniesQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const terminalStatuses = new Set(["joined", "withdrawn", "rejected"]);

function formatSalaryRange(min: number | null, max: number | null) {
  if (min === null && max === null) return "-";
  if (min !== null && max !== null) return `${min}〜${max}万円`;
  return min !== null ? `${min}万円〜` : `〜${max}万円`;
}

export function JobsPage() {
  const navigate = useNavigate();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const [view, setView] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState("");
  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);
  const companies = useMemo(
    () =>
      new Map(
        (companiesQuery.data ?? []).map((company) => [company.id, company]),
      ),
    [companiesQuery.data],
  );

  const options = useMemo(
    () => ({
      roles: [
        ...new Set(
          jobs
            .map((job) => job.occupation)
            .filter((value): value is string => Boolean(value)),
        ),
      ],
      locations: [...new Set(jobs.flatMap((job) => job.locations))],
    }),
    [jobs],
  );

  const filteredJobs = jobs.filter((job) => {
    const companyName = companies.get(job.company_id)?.name ?? "";
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const minimumSalary = salary ? Number(salary) : 0;
    return (
      (!normalizedQuery ||
        [companyName, job.title].some((value) =>
          value.toLocaleLowerCase().includes(normalizedQuery),
        )) &&
      (!role || job.occupation === role) &&
      (!location || job.locations.includes(location)) &&
      (!status || job.job_status === status) &&
      (job.salary_max ?? job.salary_min ?? 0) >= minimumSalary
    );
  });

  const clearFilters = () => {
    setQuery("");
    setRole("");
    setLocation("");
    setSalary("");
    setStatus("");
  };
  const error =
    jobsQuery.error ?? companiesQuery.error ?? applicationsQuery.error;

  return (
    <div>
      <PageIntro
        action={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/companies">
                <Building2 className="mr-1.5 size-4" />
                企業管理
              </Link>
            </Button>
            <EditorOnly>
              <Button asChild className="gap-2" size="sm">
                <Link to="/jobs/new">
                  <Plus className="size-4" />
                  新規求人登録
                </Link>
              </Button>
            </EditorOnly>
          </div>
        }
        description="取引企業の求人と選考中人数を確認します。"
        title="求人一覧"
      />
      <div className="mb-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        <button
          aria-pressed={view === "active"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
            view === "active"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
          onClick={() => setView("active")}
          type="button"
        >
          <List className="size-4" />
          利用中
        </button>
        <button
          aria-pressed={view === "archived"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
            view === "archived"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
          onClick={() => setView("archived")}
          type="button"
        >
          <Archive className="size-4" />
          アーカイブ済み
        </button>
      </div>
      {view === "archived" ? (
        <ArchivedJobs />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="求人検索"
                className="h-9 border-slate-200 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="企業名・求人名で検索"
                value={query}
              />
            </div>
            <Select
              aria-label="求人職種"
              onChange={(event) => setRole(event.target.value)}
              value={role}
            >
              <option value="">全職種</option>
              {options.roles.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select
              aria-label="求人勤務地"
              onChange={(event) => setLocation(event.target.value)}
              value={location}
            >
              <option value="">全勤務地</option>
              {options.locations.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select
              aria-label="最低年収"
              onChange={(event) => setSalary(event.target.value)}
              value={salary}
            >
              <option value="">年収指定なし</option>
              <option value="600">600万円以上</option>
              <option value="700">700万円以上</option>
              <option value="800">800万円以上</option>
            </Select>
            <Select
              aria-label="募集状況"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">全募集状況</option>
              {Object.entries(jobStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Button
              className="h-9 gap-1.5"
              onClick={clearFilters}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="size-3.5" />
              条件クリア
            </Button>
          </div>
          {jobsQuery.isPending ||
          companiesQuery.isPending ||
          applicationsQuery.isPending ? (
            <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="size-5 animate-spin" />
              求人を読み込んでいます…
            </div>
          ) : error ? (
            <EmptyState message={error.message} />
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">
                {filteredJobs.length}件を表示
              </p>
              {filteredJobs.length ? (
                <TableContainer>
                  <Table className="min-w-[980px]">
                    <thead>
                      <tr>
                        <Th>企業名</Th>
                        <Th>事業部</Th>
                        <Th>求人名</Th>
                        <Th>職種</Th>
                        <Th>勤務地</Th>
                        <Th>年収</Th>
                        <Th>募集状況</Th>
                        <Th>選考中人数</Th>
                        <Th>更新日</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredJobs.map((job) => {
                        const activeApplications = (
                          applicationsQuery.data ?? []
                        ).filter(
                          (application) =>
                            application.job_id === job.id &&
                            !terminalStatuses.has(
                              application.application_status,
                            ),
                        );
                        return (
                          <tr
                            className="cursor-pointer hover:bg-blue-50/40 focus:bg-blue-50 focus:outline-none"
                            key={job.id}
                            onClick={() => void navigate(`/jobs/${job.id}`)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ")
                                void navigate(`/jobs/${job.id}`);
                            }}
                            tabIndex={0}
                          >
                            <Td className="whitespace-nowrap font-semibold text-slate-900">
                              {companies.get(job.company_id)?.name ?? "-"}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {job.division ?? "-"}
                            </Td>
                            <Td className="min-w-52 font-medium text-blue-700">
                              <Link
                                className="hover:underline"
                                onClick={(event) => event.stopPropagation()}
                                to={`/jobs/${job.id}`}
                              >
                                {job.title}
                              </Link>
                            </Td>
                            <Td className="whitespace-nowrap">
                              {job.occupation ?? "-"}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {job.locations.join("、") || "-"}
                            </Td>
                            <Td className="whitespace-nowrap tabular-nums">
                              {formatSalaryRange(
                                job.salary_min,
                                job.salary_max,
                              )}
                            </Td>
                            <Td>
                              <Badge value={jobStatusLabels[job.job_status]} />
                            </Td>
                            <Td
                              className="text-center font-semibold tabular-nums"
                              title={activeApplications
                                .map(
                                  (item) =>
                                    applicationStatusLabels[
                                      item.application_status
                                    ],
                                )
                                .join("、")}
                            >
                              {activeApplications.length}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {formatDate(job.updated_at.slice(0, 10))}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableContainer>
              ) : (
                <EmptyState message="条件に一致する求人が見つかりません" />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
