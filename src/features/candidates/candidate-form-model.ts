import { z } from "zod";

import type {
  CandidateInsert,
  CandidateRow,
  CandidateUpdate,
} from "@/types/database";

const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => !value || z.string().email().safeParse(value).success,
    "有効なメールアドレスを入力してください。",
  );

const optionalInteger = z
  .string()
  .trim()
  .refine(
    (value) => !value || /^\d+$/.test(value),
    "0以上の整数を入力してください。",
  );

export const candidateFormSchema = z
  .object({
    full_name: z.string().trim().min(1, "氏名を入力してください。"),
    full_name_kana: z.string().trim(),
    email: optionalEmail,
    phone: z.string().trim(),
    birth_date: z.string(),
    prefecture: z.string().trim(),
    current_company: z.string().trim(),
    current_department: z.string().trim(),
    current_job_title: z.string().trim(),
    current_occupation: z.string().trim(),
    candidate_status: z.enum([
      "new",
      "contacted",
      "interview_scheduling",
      "interviewed",
      "job_proposed",
      "intention_confirming",
      "active_selection",
      "offered",
      "joined",
      "on_hold",
      "closed",
    ]),
    desired_occupations: z.string().trim(),
    desired_locations: z.string().trim(),
    current_salary_min: optionalInteger,
    current_salary_max: optionalInteger,
    desired_salary_min: optionalInteger,
    desired_salary_max: optionalInteger,
    available_from: z.string(),
    reason_for_change: z.string().trim(),
    priority_conditions: z.string().trim(),
    strengths: z.string().trim(),
    concerns: z.string().trim(),
    interview_summary: z.string().trim(),
    next_action: z.string().trim(),
    next_action_due_at: z.string(),
    waiting_on: z.enum(["self", "candidate", "company", "none"]),
    source: z.string().trim(),
    private_notes: z.string().trim(),
  })
  .superRefine((values, context) => {
    for (const [minKey, maxKey] of [
      ["current_salary_min", "current_salary_max"],
      ["desired_salary_min", "desired_salary_max"],
    ] as const) {
      const min = values[minKey] ? Number(values[minKey]) : null;
      const max = values[maxKey] ? Number(values[maxKey]) : null;
      if (min !== null && max !== null && min > max) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [maxKey],
          message: "上限は下限以上にしてください。",
        });
      }
    }
  });

export type CandidateFormValues = z.infer<typeof candidateFormSchema>;
export type CandidateWriteValues = CandidateUpdate &
  Pick<CandidateInsert, "full_name">;
export type CandidateDuplicateMatch = {
  candidate: CandidateRow;
  matchedFields: Array<"氏名" | "メールアドレス" | "電話番号">;
};

export function emptyCandidateFormValues(): CandidateFormValues {
  return {
    full_name: "",
    full_name_kana: "",
    email: "",
    phone: "",
    birth_date: "",
    prefecture: "",
    current_company: "",
    current_department: "",
    current_job_title: "",
    current_occupation: "",
    candidate_status: "new",
    desired_occupations: "",
    desired_locations: "",
    current_salary_min: "",
    current_salary_max: "",
    desired_salary_min: "",
    desired_salary_max: "",
    available_from: "",
    reason_for_change: "",
    priority_conditions: "",
    strengths: "",
    concerns: "",
    interview_summary: "",
    next_action: "",
    next_action_due_at: "",
    waiting_on: "none",
    source: "",
    private_notes: "",
  };
}

function normalizeName(value: string | null): string {
  return (value ?? "").normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function normalizeEmail(value: string | null): string {
  return (value ?? "").normalize("NFKC").trim().toLowerCase();
}

function normalizePhone(value: string | null): string {
  return (value ?? "").replace(/\D/g, "");
}

export function findCandidateDuplicates(
  values: Pick<CandidateFormValues, "full_name" | "email" | "phone">,
  candidates: CandidateRow[],
): CandidateDuplicateMatch[] {
  const name = normalizeName(values.full_name);
  const email = normalizeEmail(values.email);
  const phone = normalizePhone(values.phone);

  return candidates.flatMap((candidate) => {
    const matchedFields: CandidateDuplicateMatch["matchedFields"] = [];
    if (name && normalizeName(candidate.full_name) === name)
      matchedFields.push("氏名");
    if (email && normalizeEmail(candidate.email) === email)
      matchedFields.push("メールアドレス");
    if (phone && normalizePhone(candidate.phone) === phone)
      matchedFields.push("電話番号");
    return matchedFields.length ? [{ candidate, matchedFields }] : [];
  });
}

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

function integerOrNull(value: string): number | null {
  return value ? Number(value) : null;
}

function listFromInput(value: string): string[] {
  return value
    .split(/[、,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dateTimeOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function toCandidateValues(
  values: CandidateFormValues,
): CandidateWriteValues {
  return {
    full_name: values.full_name.trim(),
    full_name_kana: emptyToNull(values.full_name_kana),
    email: emptyToNull(values.email),
    phone: emptyToNull(values.phone),
    birth_date: values.birth_date || null,
    prefecture: emptyToNull(values.prefecture),
    current_company: emptyToNull(values.current_company),
    current_department: emptyToNull(values.current_department),
    current_job_title: emptyToNull(values.current_job_title),
    current_occupation: emptyToNull(values.current_occupation),
    candidate_status: values.candidate_status,
    desired_occupations: listFromInput(values.desired_occupations),
    desired_locations: listFromInput(values.desired_locations),
    current_salary_min: integerOrNull(values.current_salary_min),
    current_salary_max: integerOrNull(values.current_salary_max),
    desired_salary_min: integerOrNull(values.desired_salary_min),
    desired_salary_max: integerOrNull(values.desired_salary_max),
    available_from: values.available_from || null,
    reason_for_change: emptyToNull(values.reason_for_change),
    priority_conditions: emptyToNull(values.priority_conditions),
    strengths: emptyToNull(values.strengths),
    concerns: emptyToNull(values.concerns),
    interview_summary: emptyToNull(values.interview_summary),
    next_action: emptyToNull(values.next_action),
    next_action_due_at: dateTimeOrNull(values.next_action_due_at),
    waiting_on: values.waiting_on,
    source: emptyToNull(values.source),
    private_notes: emptyToNull(values.private_notes),
  };
}
