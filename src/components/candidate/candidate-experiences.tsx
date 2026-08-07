import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, LoaderCircle, Pencil, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EditorOnly } from "@/features/access/editor-only";
import {
  experienceFormSchema,
  toExperienceFormValues,
  toExperienceValues,
  type ExperienceFormValues,
} from "@/features/candidates/experience-form-model";
import {
  useArchiveCandidateExperienceMutation,
  useCandidateExperiencesQuery,
  useCreateCandidateExperienceMutation,
  useUpdateCandidateExperienceMutation,
} from "@/features/candidates/candidate-queries";
import { formatDate } from "@/lib/format";
import type { CandidateExperienceRow } from "@/types/database";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1 text-xs font-medium text-slate-600">
      <span>{label}</span>
      {children}
      {error ? <span className="block text-rose-700">{error}</span> : null}
    </label>
  );
}

function ExperienceForm({
  candidateId,
  experience,
  nextSortOrder,
  onClose,
}: {
  candidateId: string;
  experience?: CandidateExperienceRow;
  nextSortOrder: number;
  onClose: () => void;
}) {
  const createMutation = useCreateCandidateExperienceMutation(candidateId);
  const updateMutation = useUpdateCandidateExperienceMutation(candidateId);
  const form = useForm<ExperienceFormValues>({
    resolver: zodResolver(experienceFormSchema),
    defaultValues: toExperienceFormValues(experience),
  });
  const isCurrent = useWatch({ control: form.control, name: "is_current" });
  const mutation = experience ? updateMutation : createMutation;

  useEffect(() => {
    if (isCurrent) form.setValue("ended_on", "");
  }, [form, isCurrent]);

  const submit = async (values: ExperienceFormValues) => {
    const writeValues = toExperienceValues(
      candidateId,
      values,
      experience?.sort_order ?? nextSortOrder,
    );
    if (experience) {
      await updateMutation.mutateAsync({
        experienceId: experience.id,
        values: writeValues,
      });
    } else {
      await createMutation.mutateAsync(writeValues);
    }
    onClose();
  };

  return (
    <form
      className="mb-4 rounded-md border border-blue-200 bg-blue-50/40 p-4"
      onSubmit={(event) => void form.handleSubmit(submit)(event)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">
          {experience ? "職歴を編集" : "職歴を追加"}
        </h3>
        <Button
          aria-label="職歴フォームを閉じる"
          onClick={onClose}
          size="sm"
          type="button"
          variant="outline"
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field
          error={form.formState.errors.company_name?.message}
          label="勤務先 *"
        >
          <Input {...form.register("company_name")} />
        </Field>
        <Field label="部署">
          <Input {...form.register("department")} />
        </Field>
        <Field label="役職">
          <Input {...form.register("job_title")} />
        </Field>
        <Field label="職種">
          <Input {...form.register("occupation")} />
        </Field>
        <Field label="開始日">
          <Input type="date" {...form.register("started_on")} />
        </Field>
        <Field error={form.formState.errors.ended_on?.message} label="終了日">
          <Input
            disabled={isCurrent}
            type="date"
            {...form.register("ended_on")}
          />
        </Field>
        <Field label="経験領域">
          <Input {...form.register("experience_domain")} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" {...form.register("is_current")} />{" "}
          現在も在籍中
        </label>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Field label="担当業務">
          <Textarea
            className="min-h-20"
            {...form.register("responsibilities")}
          />
        </Field>
        <Field label="実績">
          <Textarea className="min-h-20" {...form.register("achievements")} />
        </Field>
      </div>
      {mutation.error ? (
        <p className="mt-3 text-sm text-rose-700">{mutation.error.message}</p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button onClick={onClose} type="button" variant="outline">
          キャンセル
        </Button>
        <Button disabled={mutation.isPending} type="submit">
          {mutation.isPending ? "保存中…" : "保存"}
        </Button>
      </div>
    </form>
  );
}

export function CandidateExperiences({ candidateId }: { candidateId: string }) {
  const query = useCandidateExperiencesQuery(candidateId);
  const archiveMutation = useArchiveCandidateExperienceMutation(candidateId);
  const [editing, setEditing] = useState<CandidateExperienceRow | "new" | null>(
    null,
  );
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const experiences = query.data ?? [];

  return (
    <SectionCard
      action={
        <EditorOnly>
          <Button
            className="gap-1.5"
            onClick={() => setEditing("new")}
            size="sm"
          >
            <Plus className="size-4" />
            職歴追加
          </Button>
        </EditorOnly>
      }
      description="候補者の在籍履歴を新しい順に管理します。削除はアーカイブとして扱います。"
      title="職務経歴"
    >
      {editing ? (
        <ExperienceForm
          candidateId={candidateId}
          experience={editing === "new" ? undefined : editing}
          nextSortOrder={experiences.length}
          onClose={() => setEditing(null)}
        />
      ) : null}
      {query.isPending ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" />
          職歴を読み込んでいます…
        </div>
      ) : query.isError ? (
        <EmptyState message={query.error.message} />
      ) : experiences.length === 0 ? (
        <EmptyState message="職歴はまだ登録されていません" />
      ) : (
        <div className="divide-y divide-slate-100">
          {experiences.map((experience) => (
            <article className="py-4 first:pt-0 last:pb-0" key={experience.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    {experience.company_name ?? "勤務先未登録"}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600">
                    {[
                      experience.department,
                      experience.job_title,
                      experience.occupation,
                    ]
                      .filter(Boolean)
                      .join(" / ") || "部署・職種未登録"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(experience.started_on ?? "-")} 〜{" "}
                    {experience.is_current
                      ? "現在"
                      : formatDate(experience.ended_on ?? "-")}
                  </p>
                </div>
                <EditorOnly>
                  <div className="flex gap-2">
                    <Button
                      aria-label={`${experience.company_name ?? "職歴"}を編集`}
                      onClick={() => setEditing(experience)}
                      size="sm"
                      variant="outline"
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    {archiveId === experience.id ? (
                      <>
                        <Button
                          disabled={archiveMutation.isPending}
                          onClick={() =>
                            void archiveMutation
                              .mutateAsync(experience.id)
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
                        aria-label={`${experience.company_name ?? "職歴"}をアーカイブ`}
                        className="text-rose-700"
                        onClick={() => setArchiveId(experience.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Archive className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </EditorOnly>
              </div>
              {experience.experience_domain ? (
                <p className="mt-2 text-xs font-medium text-blue-700">
                  経験領域：{experience.experience_domain}
                </p>
              ) : null}
              {experience.responsibilities ? (
                <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  {experience.responsibilities}
                </p>
              ) : null}
              {experience.achievements ? (
                <p className="mt-1 max-w-4xl whitespace-pre-wrap text-sm leading-6 text-slate-700">
                  <span className="font-medium">実績：</span>
                  {experience.achievements}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
