import { Archive, Building2, List, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { ArchivedCompanies } from "@/components/company/archived-companies";
import { PageIntro } from "@/components/common/page-intro";
import { EditorOnly } from "@/features/access/editor-only";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  useCompaniesQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import { cn } from "@/lib/utils";

export function CompaniesPage() {
  const companiesQuery = useCompaniesQuery();
  const jobsQuery = useJobsQuery();
  const [view, setView] = useState<"active" | "archived">("active");
  const [query, setQuery] = useState("");
  const jobCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobsQuery.data ?? [])
      counts.set(job.company_id, (counts.get(job.company_id) ?? 0) + 1);
    return counts;
  }, [jobsQuery.data]);
  const companies = (companiesQuery.data ?? []).filter((company) =>
    [company.name, company.name_kana ?? "", company.industry ?? ""].some(
      (value) =>
        value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    ),
  );
  const error = companiesQuery.error ?? jobsQuery.error;

  return (
    <div>
      <PageIntro
        action={
          <EditorOnly>
            <Button asChild className="gap-2" size="sm">
              <Link to="/companies/new">
                <Plus className="size-4" />
                新規企業登録
              </Link>
            </Button>
          </EditorOnly>
        }
        description="求人の発行元となる企業と採用担当者を管理します。"
        title="企業管理"
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
        <ArchivedCompanies />
      ) : (
        <>
          <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                aria-label="企業検索"
                className="h-9 pl-9"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="企業名・業種で検索"
                value={query}
              />
            </div>
          </div>
          {companiesQuery.isPending || jobsQuery.isPending ? (
            <p className="py-12 text-center text-sm text-slate-500">
              企業を読み込んでいます…
            </p>
          ) : error ? (
            <EmptyState message={error.message} />
          ) : companies.length ? (
            <TableContainer>
              <Table>
                <thead>
                  <tr>
                    <Th>企業名</Th>
                    <Th>業種</Th>
                    <Th>所在地</Th>
                    <Th>従業員数</Th>
                    <Th>求人件数</Th>
                    <Th>Webサイト</Th>
                    <Th>操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id}>
                      <Td className="font-semibold text-slate-900">
                        <Link
                          className="inline-flex items-center gap-2 text-blue-700 hover:underline"
                          to={`/companies/${company.id}`}
                        >
                          <Building2 className="size-4 text-slate-400" />
                          {company.name}
                        </Link>
                      </Td>
                      <Td>{company.industry ?? "-"}</Td>
                      <Td>{company.address ?? "-"}</Td>
                      <Td>{company.employees?.toLocaleString() ?? "-"}</Td>
                      <Td>{jobCounts.get(company.id) ?? 0}件</Td>
                      <Td>
                        {company.website ? (
                          <a
                            className="text-blue-700 hover:underline"
                            href={company.website}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Webサイト
                          </a>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>
                        <EditorOnly>
                          <Button
                            asChild
                            aria-label={`${company.name}を編集`}
                            size="sm"
                            variant="outline"
                          >
                            <Link to={`/companies/${company.id}/edit`}>
                              <Pencil className="size-3.5" />
                            </Link>
                          </Button>
                        </EditorOnly>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </TableContainer>
          ) : (
            <EmptyState message="企業が登録されていません" />
          )}
        </>
      )}
    </div>
  );
}
