import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Save } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";

import { SectionCard } from "@/components/common/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  candidateFormSchema,
  type CandidateFormValues,
} from "@/features/candidates/candidate-form-model";
import type {
  CandidateRow,
  CandidateStatus,
  WaitingOn,
} from "@/types/database";

const statusOptions: Array<{ value: CandidateStatus; label: string }> = [
  { value: "new", label: "新規" },
  { value: "contacted", label: "初回連絡" },
  { value: "interview_scheduling", label: "面談調整" },
  { value: "interviewed", label: "面談済み" },
  { value: "job_proposed", label: "求人提案" },
  { value: "intention_confirming", label: "応募意思確認" },
  { value: "active_selection", label: "選考中" },
  { value: "offered", label: "内定" },
  { value: "joined", label: "入社" },
  { value: "on_hold", label: "保留" },
  { value: "closed", label: "終了" },
];

const waitingOptions: Array<{ value: WaitingOn; label: string }> = [
  { value: "none", label: "待ちなし" },
  { value: "self", label: "自分待ち" },
  { value: "candidate", label: "候補者返信待ち" },
  { value: "company", label: "企業回答待ち" },
];

function valueOrEmpty(value: string | number | null): string {
  return value === null ? "" : String(value);
}

function localDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return localDate.toISOString().slice(0, 16);
}

function defaultValues(candidate?: CandidateRow): CandidateFormValues {
  return {
    full_name: candidate?.full_name ?? "",
    full_name_kana: candidate?.full_name_kana ?? "",
    email: candidate?.email ?? "",
    phone: candidate?.phone ?? "",
    birth_date: candidate?.birth_date ?? "",
    prefecture: candidate?.prefecture ?? "",
    current_company: candidate?.current_company ?? "",
    current_department: candidate?.current_department ?? "",
    current_job_title: candidate?.current_job_title ?? "",
    current_occupation: candidate?.current_occupation ?? "",
    candidate_status: candidate?.candidate_status ?? "new",
    desired_occupations: candidate?.desired_occupations.join("、") ?? "",
    desired_locations: candidate?.desired_locations.join("、") ?? "",
    current_salary_min: valueOrEmpty(candidate?.current_salary_min ?? null),
    current_salary_max: valueOrEmpty(candidate?.current_salary_max ?? null),
    desired_salary_min: valueOrEmpty(candidate?.desired_salary_min ?? null),
    desired_salary_max: valueOrEmpty(candidate?.desired_salary_max ?? null),
    available_from: candidate?.available_from ?? "",
    reason_for_change: candidate?.reason_for_change ?? "",
    priority_conditions: candidate?.priority_conditions ?? "",
    strengths: candidate?.strengths ?? "",
    concerns: candidate?.concerns ?? "",
    interview_summary: candidate?.interview_summary ?? "",
    next_action: candidate?.next_action ?? "",
    next_action_due_at: localDateTimeInput(candidate?.next_action_due_at),
    waiting_on: candidate?.waiting_on ?? "none",
    source: candidate?.source ?? "",
    private_notes: candidate?.private_notes ?? "",
  };
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-slate-700">
      {label}
      <span className="mt-1 block">{children}</span>
      {error ? <span className="mt-1 block text-rose-700">{error}</span> : null}
    </label>
  );
}

export function CandidateForm({
  candidate,
  errorMessage,
  isSubmitting,
  onCancel,
  onValuesChange,
  onSubmit,
}: {
  candidate?: CandidateRow;
  errorMessage?: string;
  isSubmitting: boolean;
  onCancel: () => void;
  onValuesChange?: () => void;
  onSubmit: (values: CandidateFormValues) => Promise<void>;
}) {
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: defaultValues(candidate),
  });

  return (
    <form
      className="space-y-4"
      onChange={onValuesChange}
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      <SectionCard title="基本情報">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field error={errors.full_name?.message} label="氏名（必須）">
            <Input autoFocus {...register("full_name")} />
          </Field>
          <Field label="氏名カナ">
            <Input {...register("full_name_kana")} />
          </Field>
          <Field label="候補者ステータス">
            <Select className="w-full" {...register("candidate_status")}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field error={errors.email?.message} label="メールアドレス">
            <Input type="email" {...register("email")} />
          </Field>
          <Field label="電話番号">
            <Input {...register("phone")} />
          </Field>
          <Field label="生年月日">
            <Input type="date" {...register("birth_date")} />
          </Field>
          <Field label="居住都道府県">
            <Input {...register("prefecture")} />
          </Field>
          <Field label="流入経路">
            <Input {...register("source")} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="現在の経歴">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="勤務先">
            <Input {...register("current_company")} />
          </Field>
          <Field label="部署">
            <Input {...register("current_department")} />
          </Field>
          <Field label="役職">
            <Input {...register("current_job_title")} />
          </Field>
          <Field label="職種">
            <Input {...register("current_occupation")} />
          </Field>
          <Field
            error={errors.current_salary_min?.message}
            label="現年収下限（万円）"
          >
            <Input inputMode="numeric" {...register("current_salary_min")} />
          </Field>
          <Field
            error={errors.current_salary_max?.message}
            label="現年収上限（万円）"
          >
            <Input inputMode="numeric" {...register("current_salary_max")} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="希望条件">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="希望職種（読点区切り）">
            <Input {...register("desired_occupations")} />
          </Field>
          <Field label="希望勤務地（読点区切り）">
            <Input {...register("desired_locations")} />
          </Field>
          <Field
            error={errors.desired_salary_min?.message}
            label="希望年収下限（万円）"
          >
            <Input inputMode="numeric" {...register("desired_salary_min")} />
          </Field>
          <Field
            error={errors.desired_salary_max?.message}
            label="希望年収上限（万円）"
          >
            <Input inputMode="numeric" {...register("desired_salary_max")} />
          </Field>
          <Field label="入社可能日">
            <Input type="date" {...register("available_from")} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Field label="転職理由">
            <Textarea {...register("reason_for_change")} />
          </Field>
          <Field label="転職優先条件">
            <Textarea {...register("priority_conditions")} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="エージェント情報">
        <div className="grid gap-4 xl:grid-cols-2">
          <Field label="強み">
            <Textarea {...register("strengths")} />
          </Field>
          <Field label="懸念点">
            <Textarea {...register("concerns")} />
          </Field>
          <Field label="面談サマリー">
            <Textarea {...register("interview_summary")} />
          </Field>
          <Field label="非公開メモ">
            <Textarea {...register("private_notes")} />
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="次回対応内容">
            <Input {...register("next_action")} />
          </Field>
          <Field label="次回対応期限">
            <Input type="datetime-local" {...register("next_action_due_at")} />
          </Field>
          <Field label="対応待ち">
            <Select className="w-full" {...register("waiting_on")}>
              {waitingOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      {errorMessage ? (
        <p
          className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          キャンセル
        </Button>
        <Button className="gap-2" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          {candidate ? "変更を保存" : "候補者を登録"}
        </Button>
      </div>
    </form>
  );
}
