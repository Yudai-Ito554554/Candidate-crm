import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";

import { ApplicationStatusHistory } from "@/components/candidate/application-status-history";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EditorOnly } from "@/features/access/editor-only";
import {
  applicationFormSchema,
  applicationStatusLabels,
  applicationStatuses,
  toApplicationFormValues,
  toApplicationValues,
  type ApplicationFormValues,
} from "@/features/applications/application-model";
import {
  useApplicationsDataQuery,
  useApplicationStatusHistoryQuery,
  useArchiveApplicationMutation,
  useCompaniesQuery,
  useCreateApplicationMutation,
  useJobsQuery,
  useUpdateApplicationMutation,
} from "@/features/applications/application-queries";
import { useAuth } from "@/features/auth/use-auth";
import { formatDate } from "@/lib/format";
import type { ApplicationRow } from "@/types/database";

const activeStages = ["提案", "応募", "書類", "面接", "内定"];
const terminalStatuses = new Set(["joined", "withdrawn", "rejected"]);

function ApplicationForm({
  candidateId,
  application,
  unavailableJobIds,
  onClose,
}: {
  candidateId: string;
  application?: ApplicationRow;
  unavailableJobIds: Set<string>;
  onClose: () => void;
}) {
  const auth = useAuth();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const createMutation = useCreateApplicationMutation();
  const updateMutation = useUpdateApplicationMutation();
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: toApplicationFormValues(application),
  });
  const mutation = application ? updateMutation : createMutation;
  const companies = new Map(
    (companiesQuery.data ?? []).map((company) => [company.id, company]),
  );
  const availableJobs = (jobsQuery.data ?? []).filter(
    (job) => job.id === application?.job_id || !unavailableJobIds.has(job.id),
  );

  const submit = async (values: ApplicationFormValues) => {
    const writeValues = toApplicationValues(candidateId, values);
    if (application) {
      await updateMutation.mutateAsync({
        applicationId: application.id,
        values: writeValues,
      });
    } else {
      await createMutation.mutateAsync({
        ...writeValues,
        owner_id: auth.user?.id ?? null,
      });
    }
    onClose();
  };

  return (
    <form
      className="rounded-lg border border-blue-200 bg-blue-50/40 p-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {application ? "提案・選考を編集" : "求人を提案"}
        </h3>
        <Button
          aria-label="提案・選考フォームを閉じる"
          onClick={onClose}
          size="sm"
          type="button"
          variant="outline"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-slate-600 xl:col-span-2">
          <span>求人 *</span>
          <Select
            className="w-full"
            disabled={Boolean(application)}
            {...form.register("job_id")}
          >
            <option value="">求人を選択</option>
            {availableJobs.map((job) => (
              <option key={job.id} value={job.id}>
                {companies.get(job.company_id)?.name ?? "企業未登録"} /{" "}
                {job.title}
              </option>
            ))}
          </Select>
          {form.formState.errors.job_id ? (
            <span className="block text-rose-700">
              {form.formState.errors.job_id.message}
            </span>
          ) : null}
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>ステータス</span>
          <Select className="w-full" {...form.register("application_status")}>
            {applicationStatuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>提案日時</span>
          <Input type="datetime-local" {...form.register("proposed_at")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>応募日時</span>
          <Input type="datetime-local" {...form.register("applied_at")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>次回予定</span>
          <Input {...form.register("next_event")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>次回予定日時</span>
          <Input type="datetime-local" {...form.register("next_event_at")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>見送り理由</span>
          <Input {...form.register("rejection_reason")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>辞退理由</span>
          <Input {...form.register("withdrawal_reason")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2">
          <span>社内メモ</span>
          <Textarea className="min-h-20" {...form.register("notes")} />
        </label>
      </div>
      {mutation.error ? (
        <p className="mt-3 text-sm text-rose-700">{mutation.error.message}</p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onClose} type="button" variant="outline">
          キャンセル
        </Button>
        <Button
          disabled={
            mutation.isPending ||
            jobsQuery.isPending ||
            companiesQuery.isPending
          }
          type="submit"
        >
          {mutation.isPending ? "保存中…" : "保存"}
        </Button>
      </div>
    </form>
  );
}

export function CandidateApplications({
  candidateId,
  initiallyAdding = false,
}: {
  candidateId: string;
  initiallyAdding?: boolean;
}) {
  const applicationsQuery = useApplicationsDataQuery();
  const statusHistoryQuery = useApplicationStatusHistoryQuery();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const archiveMutation = useArchiveApplicationMutation();
  const [editing, setEditing] = useState<ApplicationRow | "new" | null>(
    initiallyAdding ? "new" : null,
  );
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const items = (applicationsQuery.data ?? []).filter(
    (item) => item.candidate_id === candidateId,
  );
  const jobs = new Map((jobsQuery.data ?? []).map((job) => [job.id, job]));
  const companies = new Map(
    (companiesQuery.data ?? []).map((company) => [company.id, company]),
  );
  const isPending =
    applicationsQuery.isPending ||
    statusHistoryQuery.isPending ||
    jobsQuery.isPending ||
    companiesQuery.isPending;
  const error =
    applicationsQuery.error ??
    statusHistoryQuery.error ??
    jobsQuery.error ??
    companiesQuery.error;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <div className="min-w-[540px] flex-1">
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
        <EditorOnly>
          <Button
            className="gap-1.5"
            disabled={isPending}
            onClick={() => setEditing("new")}
            size="sm"
          >
            <Plus className="size-4" />
            求人を提案
          </Button>
        </EditorOnly>
      </div>
      {editing ? (
        <ApplicationForm
          application={editing === "new" ? undefined : editing}
          candidateId={candidateId}
          onClose={() => setEditing(null)}
          unavailableJobIds={
            new Set(
              items
                .filter(
                  (item) => !terminalStatuses.has(item.application_status),
                )
                .map((item) => item.job_id),
            )
          }
        />
      ) : null}
      {isPending ? (
        <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          提案・選考を読み込んでいます…
        </div>
      ) : error ? (
        <EmptyState message={error.message} />
      ) : !items.length ? (
        <EmptyState message="提案・選考中の求人はありません" />
      ) : (
        <>
          <TableContainer>
            <Table className="min-w-[1080px]">
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
                  <Th>操作</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((application) => {
                  const job = jobs.get(application.job_id);
                  const company = job
                    ? companies.get(job.company_id)
                    : undefined;
                  return (
                    <tr key={application.id}>
                      <Td className="font-medium">{company?.name ?? "-"}</Td>
                      <Td>
                        {job ? (
                          <Link
                            className="font-medium text-blue-700 hover:underline"
                            to={`/jobs/${job.id}`}
                          >
                            {job.title}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </Td>
                      <Td>
                        {formatDate(
                          (
                            application.proposed_at ??
                            application.applied_at ??
                            "-"
                          ).slice(0, 10),
                        )}
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
                        {formatDate(
                          (application.next_event_at ?? "-").slice(0, 10),
                        )}
                      </Td>
                      <Td>{formatDate(application.updated_at.slice(0, 10))}</Td>
                      <Td className="max-w-52 text-slate-500">
                        {application.withdrawal_reason ??
                          application.rejection_reason ??
                          "-"}
                      </Td>
                      <Td>
                        <EditorOnly>
                          <div className="flex gap-1.5">
                            <Button
                              aria-label={`${job?.title ?? "選考"}を編集`}
                              onClick={() => setEditing(application)}
                              size="sm"
                              variant="outline"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            {archiveId === application.id ? (
                              <>
                                <Button
                                  disabled={archiveMutation.isPending}
                                  onClick={() =>
                                    void archiveMutation
                                      .mutateAsync(application.id)
                                      .then(() => setArchiveId(null))
                                  }
                                  size="sm"
                                >
                                  実行
                                </Button>
                                <Button
                                  onClick={() => setArchiveId(null)}
                                  size="sm"
                                  variant="outline"
                                >
                                  戻る
                                </Button>
                              </>
                            ) : (
                              <Button
                                aria-label={`${job?.title ?? "選考"}をアーカイブ`}
                                className="text-rose-700"
                                onClick={() => setArchiveId(application.id)}
                                size="sm"
                                variant="outline"
                              >
                                <Archive className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </EditorOnly>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </TableContainer>
          <ApplicationStatusHistory
            applications={items}
            companies={companiesQuery.data ?? []}
            histories={statusHistoryQuery.data ?? []}
            jobs={jobsQuery.data ?? []}
          />
        </>
      )}
    </div>
  );
}
