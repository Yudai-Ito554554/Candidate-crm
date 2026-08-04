import { Plus, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { PlannedButton } from "@/components/common/planned-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { jobs } from "@/data/mock-data";
import { formatDate, formatSalary } from "@/lib/format";

export function JobsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [status, setStatus] = useState("");

  const options = useMemo(
    () => ({
      roles: [...new Set(jobs.map((job) => job.role))],
      locations: [...new Set(jobs.map((job) => job.location))],
      statuses: [...new Set(jobs.map((job) => job.status))],
    }),
    [],
  );

  const filteredJobs = jobs.filter((job) => {
    const normalizedQuery = query.trim().toLowerCase();
    const queryMatched =
      !normalizedQuery ||
      [job.company, job.title].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      );
    const minimumSalary = salary ? Number(salary) : 0;
    return (
      queryMatched &&
      (!role || job.role === role) &&
      (!location || job.location === location) &&
      (!status || job.status === status) &&
      job.salaryMax >= minimumSalary
    );
  });

  const clearFilters = () => {
    setQuery("");
    setRole("");
    setLocation("");
    setSalary("");
    setStatus("");
  };

  return (
    <div>
      <PageIntro
        action={
          <PlannedButton className="gap-2" size="sm">
            <Plus className="size-4" />
            新規求人登録
          </PlannedButton>
        }
        description="取引企業の求人と選考中人数を確認します。"
        title="求人一覧"
      />
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
          {options.statuses.map((value) => (
            <option key={value}>{value}</option>
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
              {filteredJobs.map((job) => (
                <tr
                  className="cursor-pointer hover:bg-blue-50/40 focus:bg-blue-50 focus:outline-none"
                  key={job.id}
                  onClick={() => {
                    void navigate(`/jobs/${job.id}`);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ")
                      void navigate(`/jobs/${job.id}`);
                  }}
                  tabIndex={0}
                >
                  <Td className="whitespace-nowrap font-semibold text-slate-900">
                    {job.company}
                  </Td>
                  <Td className="whitespace-nowrap">{job.division}</Td>
                  <Td className="min-w-52 font-medium text-blue-700">
                    <Link
                      className="hover:underline"
                      onClick={(event) => event.stopPropagation()}
                      to={`/jobs/${job.id}`}
                    >
                      {job.title}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{job.role}</Td>
                  <Td className="whitespace-nowrap">{job.location}</Td>
                  <Td className="whitespace-nowrap tabular-nums">
                    {formatSalary(job.salaryMin, job.salaryMax)}
                  </Td>
                  <Td>
                    <Badge value={job.status} />
                  </Td>
                  <Td className="text-center font-semibold tabular-nums">
                    {job.activeCandidates}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(job.updatedAt)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState message="条件に一致する求人が見つかりません" />
      )}
    </div>
  );
}
