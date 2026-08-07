import { ArchiveRestore, LoaderCircle } from "lucide-react";
import { useState } from "react";

import { EditorOnly } from "@/features/access/editor-only";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  useArchivedCandidatesQuery,
  useRestoreCandidateMutation,
} from "@/features/candidates/candidate-queries";
import { candidateStatusLabels } from "@/features/candidates/candidate-view";
import { formatDateTime } from "@/lib/format";

export function ArchivedCandidates() {
  const candidatesQuery = useArchivedCandidatesQuery();
  const restoreMutation = useRestoreCandidateMutation();
  const [restoredName, setRestoredName] = useState<string | null>(null);

  const restore = async (candidateId: string, candidateName: string) => {
    await restoreMutation.mutateAsync(candidateId);
    setRestoredName(candidateName);
  };

  if (candidatesQuery.isPending)
    return (
      <div className="flex min-h-64 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600">
        <LoaderCircle className="size-5 animate-spin" />
        アーカイブ済み候補者を読み込んでいます…
      </div>
    );

  if (candidatesQuery.isError)
    return (
      <div
        className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-center"
        role="alert"
      >
        <p className="text-sm text-rose-700">
          アーカイブ済み候補者を取得できませんでした。
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
    );

  const candidates = candidatesQuery.data ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{candidates.length}名を表示</span>
        <span>復元すると通常の候補者一覧へ戻ります</span>
      </div>
      {restoredName ? (
        <p
          className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {restoredName}を候補者一覧へ復元しました。
        </p>
      ) : null}
      {restoreMutation.isError ? (
        <p
          className="mb-3 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          候補者を復元できませんでした。時間を置いて再度お試しください。
        </p>
      ) : null}
      {candidates.length ? (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <Th>氏名</Th>
                <Th>現勤務先・職種</Th>
                <Th>居住地</Th>
                <Th>ステータス</Th>
                <Th>アーカイブ日時</Th>
                <Th className="text-right">操作</Th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={candidate.id}>
                  <Td className="font-semibold text-slate-900">
                    {candidate.full_name}
                  </Td>
                  <Td>
                    <p>{candidate.current_company ?? "-"}</p>
                    <p className="text-xs text-slate-500">
                      {candidate.current_occupation ??
                        candidate.current_job_title ??
                        "-"}
                    </p>
                  </Td>
                  <Td>{candidate.prefecture ?? "-"}</Td>
                  <Td>
                    <Badge
                      value={candidateStatusLabels[candidate.candidate_status]}
                    />
                  </Td>
                  <Td className="whitespace-nowrap">
                    {candidate.archived_at
                      ? formatDateTime(candidate.archived_at)
                      : "-"}
                  </Td>
                  <Td className="text-right">
                    <EditorOnly>
                      <Button
                        aria-label={`${candidate.full_name}を復元`}
                        className="gap-1.5"
                        disabled={restoreMutation.isPending}
                        onClick={() =>
                          void restore(candidate.id, candidate.full_name)
                        }
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
        <EmptyState message="アーカイブ済み候補者はいません" />
      )}
    </div>
  );
}
