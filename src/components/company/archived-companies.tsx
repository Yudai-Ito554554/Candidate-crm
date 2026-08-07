import { ArchiveRestore, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { EditorOnly } from "@/features/access/editor-only";
import {
  useArchivedCompaniesQuery,
  useRestoreCompanyMutation,
} from "@/features/applications/application-queries";
import { formatDateTime } from "@/lib/format";

export function ArchivedCompanies() {
  const companiesQuery = useArchivedCompaniesQuery();
  const restoreMutation = useRestoreCompanyMutation();
  const [restoredName, setRestoredName] = useState<string | null>(null);

  const restore = async (companyId: string, companyName: string) => {
    await restoreMutation.mutateAsync(companyId);
    setRestoredName(companyName);
  };

  if (companiesQuery.isPending)
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        アーカイブ済み企業を読み込んでいます…
      </div>
    );

  if (companiesQuery.isError)
    return (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-center"
        role="alert"
      >
        <p className="text-sm text-rose-700">
          アーカイブ済み企業を取得できませんでした。
        </p>
        <Button
          className="mt-3"
          onClick={() => void companiesQuery.refetch()}
          size="sm"
          variant="outline"
        >
          再試行
        </Button>
      </div>
    );

  const companies = companiesQuery.data ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{companies.length}社を表示</span>
        <span>復元すると通常の企業一覧へ戻ります</span>
      </div>
      {restoredName ? (
        <p
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {restoredName}を企業一覧へ復元しました。
        </p>
      ) : null}
      {restoreMutation.isError ? (
        <p
          className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          企業を復元できませんでした。時間を置いて再度お試しください。
        </p>
      ) : null}
      {companies.length ? (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <Th>企業名</Th>
                <Th>業種</Th>
                <Th>所在地</Th>
                <Th>Webサイト</Th>
                <Th>アーカイブ日時</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <Td className="font-semibold text-slate-900">
                    {company.name}
                  </Td>
                  <Td>{company.industry ?? "-"}</Td>
                  <Td>{company.address ?? "-"}</Td>
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
                  <Td className="whitespace-nowrap">
                    {company.archived_at
                      ? formatDateTime(company.archived_at)
                      : "-"}
                  </Td>
                  <Td className="text-right">
                    <EditorOnly>
                      <Button
                        aria-label={`${company.name}を復元`}
                        className="gap-1.5"
                        disabled={restoreMutation.isPending}
                        onClick={() => void restore(company.id, company.name)}
                        size="sm"
                        variant="outline"
                      >
                        <ArchiveRestore className="size-3.5" />
                        復元
                      </Button>
                    </EditorOnly>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState message="アーカイブ済み企業はありません" />
      )}
    </div>
  );
}
