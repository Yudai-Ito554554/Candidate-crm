import { ArchiveRestore, LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { EditorOnly } from "@/features/access/editor-only";
import { jobStatusLabels } from "@/features/applications/application-model";
import {
  useArchivedCompaniesQuery,
  useArchivedJobsQuery,
  useCompaniesQuery,
  useRestoreJobMutation,
} from "@/features/applications/application-queries";
import { formatDateTime } from "@/lib/format";

export function ArchivedJobs() {
  const jobsQuery = useArchivedJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const archivedCompaniesQuery = useArchivedCompaniesQuery();
  const restoreMutation = useRestoreJobMutation();
  const [restoredTitle, setRestoredTitle] = useState<string | null>(null);
  const activeCompanyIds = useMemo(
    () => new Set((companiesQuery.data ?? []).map((company) => company.id)),
    [companiesQuery.data],
  );
  const companies = useMemo(
    () =>
      new Map(
        [
          ...(companiesQuery.data ?? []),
          ...(archivedCompaniesQuery.data ?? []),
        ].map((company) => [company.id, company.name]),
      ),
    [archivedCompaniesQuery.data, companiesQuery.data],
  );

  const restore = async (jobId: string, jobTitle: string) => {
    await restoreMutation.mutateAsync(jobId);
    setRestoredTitle(jobTitle);
  };

  if (
    jobsQuery.isPending ||
    companiesQuery.isPending ||
    archivedCompaniesQuery.isPending
  )
    return (
      <div className="flex min-h-52 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        アーカイブ済み求人を読み込んでいます…
      </div>
    );

  if (
    jobsQuery.isError ||
    companiesQuery.isError ||
    archivedCompaniesQuery.isError
  )
    return (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-center"
        role="alert"
      >
        <p className="text-sm text-rose-700">
          アーカイブ済み求人を取得できませんでした。
        </p>
        <Button
          className="mt-3"
          onClick={() => {
            void jobsQuery.refetch();
            void companiesQuery.refetch();
            void archivedCompaniesQuery.refetch();
          }}
          size="sm"
          variant="outline"
        >
          再試行
        </Button>
      </div>
    );

  const jobs = jobsQuery.data ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{jobs.length}件を表示</span>
        <span>復元すると通常の求人一覧へ戻ります</span>
      </div>
      {restoredTitle ? (
        <p
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {restoredTitle}を求人一覧へ復元しました。
        </p>
      ) : null}
      {restoreMutation.isError ? (
        <p
          className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          求人を復元できませんでした。時間を置いて再度お試しください。
        </p>
      ) : null}
      {jobs.length ? (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <Th>企業名</Th>
                <Th>求人名</Th>
                <Th>職種</Th>
                <Th>勤務地</Th>
                <Th>募集状況</Th>
                <Th>アーカイブ日時</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const companyIsActive = activeCompanyIds.has(job.company_id);
                return (
                  <tr key={job.id}>
                    <Td>{companies.get(job.company_id) ?? "-"}</Td>
                    <Td className="font-semibold text-slate-900">
                      {job.title}
                    </Td>
                    <Td>{job.occupation ?? "-"}</Td>
                    <Td>{job.locations.join("、") || "-"}</Td>
                    <Td>
                      <Badge value={jobStatusLabels[job.job_status]} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      {job.archived_at ? formatDateTime(job.archived_at) : "-"}
                    </Td>
                    <Td className="text-right">
                      <EditorOnly>
                        {companyIsActive ? (
                          <Button
                            aria-label={`${job.title}を復元`}
                            className="gap-1.5"
                            disabled={restoreMutation.isPending}
                            onClick={() => void restore(job.id, job.title)}
                            size="sm"
                            variant="outline"
                          >
                            <ArchiveRestore className="size-3.5" />
                            復元
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-amber-700">
                            先に企業を復元
                          </span>
                        )}
                      </EditorOnly>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState message="アーカイブ済み求人はありません" />
      )}
    </div>
  );
}
