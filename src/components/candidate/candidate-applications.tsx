import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { applications, getJob } from "@/data/mock-data";
import { formatDate } from "@/lib/format";

const activeStages = ["提案", "応募", "書類", "面接", "内定"];

export function CandidateApplications({
  candidateId,
}: {
  candidateId: string;
}) {
  const items = applications.filter(
    (application) => application.candidateId === candidateId,
  );
  if (!items.length)
    return <EmptyState message="提案・選考中の求人はありません" />;
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">
          候補者単位の進行状況
        </p>
        <div className="flex items-center">
          {activeStages.map((stage, index) => (
            <div className="flex flex-1 items-center" key={stage}>
              <span className="flex size-6 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
                {index + 1}
              </span>
              <span className="ml-1 text-xs text-slate-600">{stage}</span>
              {index < activeStages.length - 1 ? (
                <span className="mx-2 h-px flex-1 bg-slate-200" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <TableContainer>
        <Table className="min-w-[980px]">
          <thead>
            <tr>
              <Th>企業名</Th>
              <Th>求人名</Th>
              <Th>提案日</Th>
              <Th>現在のステータス</Th>
              <Th>次回予定</Th>
              <Th>次回予定日</Th>
              <Th>最終更新日</Th>
              <Th>辞退・見送り理由</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((application) => {
              const job = getJob(application.jobId);
              return (
                <tr key={application.id}>
                  <Td className="font-medium">{job?.company}</Td>
                  <Td>{job?.title}</Td>
                  <Td>
                    {formatDate(
                      application.proposedAt ?? application.appliedAt,
                    )}
                  </Td>
                  <Td>
                    <Badge value={application.status} />
                  </Td>
                  <Td>{application.nextStep}</Td>
                  <Td>{formatDate(application.nextStepDate)}</Td>
                  <Td>{formatDate(application.updatedAt)}</Td>
                  <Td className="text-slate-500">
                    {application.declineReason ?? "-"}
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
