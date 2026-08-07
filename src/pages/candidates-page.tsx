import {
  Archive,
  KanbanSquare,
  List,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { ArchivedCandidates } from "@/components/candidate/archived-candidates";
import { EditorOnly } from "@/features/access/editor-only";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  useApplicationsQuery,
  useCandidatesQuery,
  useProfilesQuery,
} from "@/features/candidates/candidate-queries";
import { toCandidateView } from "@/features/candidates/candidate-view";
import { formatDate, isOverdueDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PipelineBoard } from "@/pages/pipeline-page";

export function CandidatesPage() {
  const navigate = useNavigate();
  const candidatesQuery = useCandidatesQuery();
  const profilesQuery = useProfilesQuery();
  const applicationsQuery = useApplicationsQuery();
  const [view, setView] = useState<"list" | "pipeline" | "archived">("list");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const candidateViews = useMemo(
    () =>
      (candidatesQuery.data ?? []).map((candidate) =>
        toCandidateView(
          candidate,
          profilesQuery.data ?? [],
          applicationsQuery.data ?? [],
        ),
      ),
    [applicationsQuery.data, candidatesQuery.data, profilesQuery.data],
  );
  const options = useMemo(
    () => ({
      statuses: [
        ...new Set(candidateViews.map((candidate) => candidate.status)),
      ],
      roles: [
        ...new Set(candidateViews.map((candidate) => candidate.currentRole)),
      ],
      locations: [
        ...new Set(candidateViews.map((candidate) => candidate.location)),
      ],
      owners: [...new Set(candidateViews.map((candidate) => candidate.owner))],
    }),
    [candidateViews],
  );
  const filteredCandidates = candidateViews.filter((candidate) => {
    const normalizedQuery = query.trim().toLowerCase();
    return (
      (!normalizedQuery ||
        [candidate.name, candidate.company, candidate.currentRole].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        )) &&
      (!status || candidate.status === status) &&
      (!role || candidate.currentRole === role) &&
      (!location || candidate.location === location) &&
      (!owner || candidate.owner === owner)
    );
  });
  const clearFilters = () => {
    setQuery("");
    setStatus("");
    setRole("");
    setLocation("");
    setOwner("");
  };

  return (
    <div>
      <PageIntro
        action={
          <EditorOnly>
            <Button asChild className="gap-2" size="sm">
              <Link to="/candidates/new">
                <Plus className="size-4" />
                新規候補者登録
              </Link>
            </Button>
          </EditorOnly>
        }
        description="候補者を中心に、一覧と進捗パイプラインを切り替えます。"
        title="候補者"
      />
      <div className="mb-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        <button
          aria-pressed={view === "list"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
            view === "list"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
          onClick={() => setView("list")}
          type="button"
        >
          <List className="size-4" />
          一覧
        </button>
        <button
          aria-pressed={view === "pipeline"}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium",
            view === "pipeline"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100",
          )}
          onClick={() => setView("pipeline")}
          type="button"
        >
          <KanbanSquare className="size-4" />
          パイプライン
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
      {view === "pipeline" ? (
        <PipelineBoard />
      ) : view === "archived" ? (
        <ArchivedCandidates />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="relative min-w-64 flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="候補者検索"
                className="h-9 border-slate-200 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="氏名・勤務先・職種で検索"
                value={query}
              />
            </div>
            <Select
              aria-label="候補者ステータス"
              onChange={(event) => setStatus(event.target.value)}
              value={status}
            >
              <option value="">全ステータス</option>
              {options.statuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select
              aria-label="職種"
              onChange={(event) => setRole(event.target.value)}
              value={role}
            >
              <option value="">全職種</option>
              {options.roles.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select
              aria-label="居住地"
              onChange={(event) => setLocation(event.target.value)}
              value={location}
            >
              <option value="">全居住地</option>
              {options.locations.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </Select>
            <Select
              aria-label="担当者"
              onChange={(event) => setOwner(event.target.value)}
              value={owner}
            >
              <option value="">全担当者</option>
              {options.owners.map((value) => (
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
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>{filteredCandidates.length}名を表示</span>
            <span>次回対応日が本日以前の候補者を赤字表示</span>
          </div>
          {candidatesQuery.isPending ? (
            <div className="flex min-h-64 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
              <LoaderCircle className="size-5 animate-spin" />
              候補者を読み込んでいます…
            </div>
          ) : candidatesQuery.isError ? (
            <div
              className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-center"
              role="alert"
            >
              <p className="text-sm text-rose-700">
                {candidatesQuery.error instanceof Error
                  ? candidatesQuery.error.message
                  : "候補者を取得できませんでした。"}
              </p>
              <Button
                className="mt-3"
                onClick={() => void candidatesQuery.refetch()}
                size="sm"
                variant="outline"
              >
                再試行
              </Button>
            </div>
          ) : filteredCandidates.length ? (
            <TableContainer>
              <Table className="min-w-[980px]">
                <thead>
                  <tr>
                    <Th className="sticky left-0 z-10 bg-slate-50">氏名</Th>
                    <Th>現勤務先・職種</Th>
                    <Th>居住地</Th>
                    <Th>希望勤務地</Th>
                    <Th>ステータス</Th>
                    <Th>選考中求人</Th>
                    <Th>最終対応日</Th>
                    <Th>次回対応日</Th>
                    <Th>担当者</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.map((candidate) => (
                    <tr
                      className="group cursor-pointer hover:bg-blue-50/40 focus:bg-blue-50 focus:outline-none"
                      key={candidate.id}
                      onClick={() => {
                        void navigate(`/candidates/${candidate.id}`);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ")
                          void navigate(`/candidates/${candidate.id}`);
                      }}
                      tabIndex={0}
                    >
                      <Td className="sticky left-0 z-[1] whitespace-nowrap bg-white group-hover:bg-blue-50">
                        <Link
                          className="font-semibold text-blue-700 hover:underline"
                          onClick={(event) => event.stopPropagation()}
                          to={`/candidates/${candidate.id}`}
                        >
                          {candidate.name}
                        </Link>
                      </Td>
                      <Td className="max-w-52">
                        <p className="truncate" title={candidate.company}>
                          {candidate.company}
                        </p>
                        <p className="text-xs text-slate-500">
                          {candidate.currentRole}
                        </p>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {candidate.location}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {candidate.desiredLocation}
                      </Td>
                      <Td>
                        <Badge value={candidate.status} />
                      </Td>
                      <Td className="text-center font-semibold tabular-nums">
                        {candidate.activeApplications}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatDate(candidate.lastContactDate)}
                      </Td>
                      <Td
                        className={cn(
                          "whitespace-nowrap",
                          isOverdueDate(candidate.nextContactDate) &&
                            "font-semibold text-rose-700",
                        )}
                      >
                        {formatDate(candidate.nextContactDate)}
                      </Td>
                      <Td className="whitespace-nowrap">{candidate.owner}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState message="条件に一致する候補者が見つかりません" />
          )}
        </>
      )}
    </div>
  );
}
