import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useApplicationsDataQuery,
  useCompaniesQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import { useAuth } from "@/features/auth/use-auth";
import { useCandidatesQuery } from "@/features/candidates/candidate-queries";
import {
  taskFormSchema,
  taskPriorityLabels,
  taskTypeLabels,
  toTaskFormValues,
  toTaskValues,
  waitingOnLabels,
  type TaskFormValues,
} from "@/features/work/work-model";
import {
  useCreateTaskMutation,
  useUpdateTaskMutation,
} from "@/features/work/work-queries";
import type { TaskRow } from "@/types/database";

export function TaskForm({
  candidateId = "",
  task,
  onClose,
}: {
  candidateId?: string;
  task?: TaskRow;
  onClose: () => void;
}) {
  const auth = useAuth();
  const candidatesQuery = useCandidatesQuery();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const createMutation = useCreateTaskMutation();
  const updateMutation = useUpdateTaskMutation();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: toTaskFormValues(task, candidateId),
  });
  const selectedCandidateId = useWatch({
    control: form.control,
    name: "candidate_id",
  });
  const applicationField = form.register("application_id");
  const availableApplications = (applicationsQuery.data ?? []).filter(
    (application) =>
      !selectedCandidateId || application.candidate_id === selectedCandidateId,
  );
  const companies = new Map(
    (companiesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const submit = async (values: TaskFormValues) => {
    const write = toTaskValues(auth.user?.id ?? null, values);
    if (task) await updateMutation.mutateAsync({ id: task.id, values: write });
    else await createMutation.mutateAsync(write);
    onClose();
  };
  const mutation = task ? updateMutation : createMutation;
  return (
    <form
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="mb-3 flex justify-between">
        <h3 className="text-sm font-semibold">
          {task ? "タスクを編集" : "タスクを追加"}
        </h3>
        <Button
          aria-label="タスクフォームを閉じる"
          onClick={onClose}
          size="sm"
          type="button"
          variant="outline"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-medium text-slate-600">
          候補者
          <Select
            className="w-full"
            disabled={Boolean(candidateId)}
            {...form.register("candidate_id")}
          >
            <option value="">未設定</option>
            {(candidatesQuery.data ?? []).map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.full_name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          種別
          <Select className="w-full" {...form.register("task_type")}>
            {Object.entries(taskTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          優先度
          <Select className="w-full" {...form.register("priority")}>
            {Object.entries(taskPriorityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          期限
          <Input type="datetime-local" {...form.register("due_at")} />
        </label>
        <label className="text-xs font-medium text-slate-600 md:col-span-2">
          タスク内容 *<Input {...form.register("title")} />
          {form.formState.errors.title ? (
            <span className="text-rose-700">
              {form.formState.errors.title.message}
            </span>
          ) : null}
        </label>
        <label className="text-xs font-medium text-slate-600">
          相手待ち
          <Select className="w-full" {...form.register("waiting_on")}>
            {Object.entries(waitingOnLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          関連求人
          <Select className="w-full" {...form.register("job_id")}>
            <option value="">未設定</option>
            {(jobsQuery.data ?? []).map((job) => (
              <option key={job.id} value={job.id}>
                {companies.get(job.company_id)?.name ?? "企業未登録"} /{" "}
                {job.title}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600 md:col-span-2">
          関連選考
          <Select
            className="w-full"
            {...applicationField}
            onChange={(event) => {
              void applicationField.onChange(event);
              const selected = availableApplications.find(
                (item) => item.id === event.target.value,
              );
              if (selected) {
                form.setValue("candidate_id", selected.candidate_id);
                form.setValue("job_id", selected.job_id);
              }
            }}
          >
            <option value="">未設定</option>
            {availableApplications.map((application) => {
              const job = (jobsQuery.data ?? []).find(
                (item) => item.id === application.job_id,
              );
              return (
                <option key={application.id} value={application.id}>
                  {job?.title ?? "求人未登録"}
                </option>
              );
            })}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600 md:col-span-2">
          詳細
          <Textarea {...form.register("description")} />
        </label>
      </div>
      {mutation.error ? (
        <p className="mt-2 text-sm text-rose-700">{mutation.error.message}</p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onClose} type="button" variant="outline">
          キャンセル
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          保存
        </Button>
      </div>
    </form>
  );
}
