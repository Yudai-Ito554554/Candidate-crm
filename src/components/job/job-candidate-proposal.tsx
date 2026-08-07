import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  applicationFormSchema,
  applicationStatuses,
  toApplicationFormValues,
  toApplicationValues,
} from "@/features/applications/application-model";
import { useCreateApplicationMutation } from "@/features/applications/application-queries";
import { useAuth } from "@/features/auth/use-auth";
import type { ApplicationRow, CandidateRow } from "@/types/database";

const proposalSchema = applicationFormSchema.extend({
  candidate_id: z.string().min(1, "候補者を選択してください。"),
});

type ProposalValues = z.infer<typeof proposalSchema>;
const terminalStatuses = new Set(["joined", "withdrawn", "rejected"]);

export function JobCandidateProposal({
  applications,
  candidates,
  jobId,
  onClose,
}: {
  applications: ApplicationRow[];
  candidates: CandidateRow[];
  jobId: string;
  onClose: () => void;
}) {
  const auth = useAuth();
  const mutation = useCreateApplicationMutation();
  const unavailableCandidateIds = new Set(
    applications
      .filter(
        (application) =>
          application.job_id === jobId &&
          !terminalStatuses.has(application.application_status),
      )
      .map((application) => application.candidate_id),
  );
  const availableCandidates = candidates.filter(
    (candidate) => !unavailableCandidateIds.has(candidate.id),
  );
  const form = useForm<ProposalValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      ...toApplicationFormValues(),
      candidate_id: "",
      job_id: jobId,
    },
  });

  const submit = async ({
    candidate_id: candidateId,
    ...values
  }: ProposalValues) => {
    await mutation.mutateAsync({
      ...toApplicationValues(candidateId, values),
      owner_id: auth.user?.id ?? null,
    });
    onClose();
  };

  return (
    <form
      aria-label="求人への候補者提案"
      className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">候補者を提案</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            この求人へ提案する候補者と初期ステータスを選択します。
          </p>
        </div>
        <Button
          aria-label="候補者提案フォームを閉じる"
          onClick={onClose}
          size="sm"
          type="button"
          variant="outline"
        >
          <X className="size-4" />
        </Button>
      </div>

      <input type="hidden" {...form.register("job_id")} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2">
          <span>候補者 *</span>
          <Select className="w-full" {...form.register("candidate_id")}>
            <option value="">候補者を選択</option>
            {availableCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.full_name} /{" "}
                {candidate.current_occupation ?? "職種未登録"}
              </option>
            ))}
          </Select>
          {form.formState.errors.candidate_id ? (
            <span className="block text-rose-700">
              {form.formState.errors.candidate_id.message}
            </span>
          ) : null}
          {!availableCandidates.length ? (
            <span className="block text-amber-800">
              提案可能な候補者がいません。進行中の重複選考を確認してください。
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
        <label className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2">
          <span>次回予定</span>
          <Input {...form.register("next_event")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600">
          <span>次回予定日時</span>
          <Input type="datetime-local" {...form.register("next_event_at")} />
        </label>
        <label className="space-y-1 text-xs font-medium text-slate-600 md:col-span-2 xl:col-span-4">
          <span>社内メモ</span>
          <Textarea className="min-h-20" {...form.register("notes")} />
        </label>
      </div>

      {mutation.error ? (
        <p className="mt-3 text-sm text-rose-700" role="alert">
          {mutation.error.message}
        </p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onClose} type="button" variant="outline">
          キャンセル
        </Button>
        <Button
          disabled={mutation.isPending || !availableCandidates.length}
          type="submit"
        >
          {mutation.isPending ? "保存中…" : "提案を保存"}
        </Button>
      </div>
    </form>
  );
}
