import { Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { applications, getCandidate, getJob } from "@/data/mock-data";
import { formatDate, mockToday } from "@/lib/format";

export function ApplicationsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const statuses = [
    ...new Set(applications.map((application) => application.status)),
  ];
  const filteredApplications = applications.filter((application) => {
    const candidate = getCandidate(application.candidateId);
    const job = getJob(application.jobId);
    const normalizedQuery = query.trim().toLowerCase();
    return (
      (!normalizedQuery ||
        [candidate?.name ?? "", job?.company ?? "", job?.title ?? ""].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        )) &&
      (!status || application.status === status)
    );
  });

  return (
    <div>
      <PageIntro
        description="候補者と求人の組み合わせごとに選考進捗を管理します。"
        title="選考一覧"
      />
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="選考検索"
            className="h-9 border-slate-200 pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="候補者・企業・求人名で検索"
            value={query}
          />
        </div>
        <Select
          aria-label="選考ステータス"
          onChange={(event) => setStatus(event.target.value)}
          value={status}
        >
          <option value="">全ステータス</option>
          {statuses.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </Select>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        {filteredApplications.length}件の選考を表示
      </p>
      <TableContainer>
        <Table className="min-w-[1040px]">
          <thead>
            <tr>
              <Th>候補者名</Th>
              <Th>企業名</Th>
              <Th>求人名</Th>
              <Th>現在の選考ステータス</Th>
              <Th>応募日</Th>
              <Th>次回予定</Th>
              <Th>次回予定日</Th>
              <Th>最終更新日</Th>
            </tr>
          </thead>
          <tbody>
            {filteredApplications.map((application) => {
              const candidate = getCandidate(application.candidateId);
              const job = getJob(application.jobId);
              return (
                <tr className="hover:bg-blue-50/40" key={application.id}>
                  <Td className="whitespace-nowrap">
                    <Link
                      className="font-semibold text-blue-700 hover:underline"
                      to={`/candidates/${application.candidateId}`}
                    >
                      {candidate?.name}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap font-medium text-slate-900">
                    {job?.company}
                  </Td>
                  <Td className="min-w-48">{job?.title}</Td>
                  <Td>
                    <Badge value={application.status} />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(application.appliedAt)}
                  </Td>
                  <Td>{application.nextStep}</Td>
                  <Td
                    className={`whitespace-nowrap ${application.nextStepDate <= mockToday ? "font-semibold text-rose-700" : ""}`}
                  >
                    {formatDate(application.nextStepDate)}
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(application.updatedAt)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </TableContainer>
    </div>
  );
}
