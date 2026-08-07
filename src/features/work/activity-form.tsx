import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";

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
import {
  activityFormSchema,
  activityTypes,
  toActivityFormValues,
  toActivityValues,
  type ActivityFormValues,
} from "@/features/work/work-model";
import {
  useCreateActivityMutation,
  useUpdateActivityMutation,
} from "@/features/work/work-queries";
import type { ActivityRow } from "@/types/database";

export function ActivityForm({
  candidateId,
  activity,
  onClose,
}: {
  candidateId: string;
  activity?: ActivityRow;
  onClose: () => void;
}) {
  const auth = useAuth();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const applicationsQuery = useApplicationsDataQuery();
  const createMutation = useCreateActivityMutation(candidateId);
  const updateMutation = useUpdateActivityMutation(candidateId);
  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: toActivityFormValues(activity),
  });
  const applicationField = form.register("application_id");
  const companies = new Map(
    (companiesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const candidateApplications = (applicationsQuery.data ?? []).filter(
    (item) => item.candidate_id === candidateId,
  );
  const submit = async (values: ActivityFormValues) => {
    const write = toActivityValues(candidateId, auth.user?.id ?? null, values);
    if (activity)
      await updateMutation.mutateAsync({ id: activity.id, values: write });
    else await createMutation.mutateAsync(write);
    onClose();
  };
  const mutation = activity ? updateMutation : createMutation;
  return (
    <form
      className="rounded-md border border-blue-200 bg-blue-50/40 p-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="mb-3 flex justify-between">
        <h3 className="text-sm font-semibold">
          {activity ? "活動を編集" : "活動を追加"}
        </h3>
        <Button
          aria-label="活動フォームを閉じる"
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
          種別
          <Select className="w-full" {...form.register("activity_type")}>
            {activityTypes.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          日時 *
          <Input type="datetime-local" {...form.register("occurred_at")} />
        </label>
        <label className="text-xs font-medium text-slate-600 md:col-span-2">
          タイトル *<Input {...form.register("title")} />
          {form.formState.errors.title ? (
            <span className="text-rose-700">
              {form.formState.errors.title.message}
            </span>
          ) : null}
        </label>
        <label className="text-xs font-medium text-slate-600">
          方向
          <Select className="w-full" {...form.register("direction")}>
            <option value="internal">社内</option>
            <option value="outbound">送信・発信</option>
            <option value="inbound">受信・着信</option>
            <option value="none">指定なし</option>
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
              const selected = candidateApplications.find(
                (item) => item.id === event.target.value,
              );
              if (selected) form.setValue("job_id", selected.job_id);
            }}
          >
            <option value="">未設定</option>
            {candidateApplications.map((application) => {
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
        <label className="text-xs font-medium text-slate-600 md:col-span-2 xl:col-span-4">
          内容
          <Textarea {...form.register("body")} />
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
