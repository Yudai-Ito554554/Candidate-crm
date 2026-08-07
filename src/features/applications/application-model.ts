import { z } from "zod";

import type {
  ApplicationInsert,
  ApplicationRow,
  ApplicationStatus,
  JobStatus,
} from "@/types/database";

export const applicationStatusLabels: Record<ApplicationStatus, string> = {
  considering: "検討中",
  intention_confirming: "応募意思確認",
  proposed: "求人提案",
  applied: "応募済み",
  document_screening: "書類選考",
  first_interview: "一次面接",
  second_interview: "二次面接",
  final_interview: "最終面接",
  offer: "オファー",
  accepted: "内定",
  joined: "入社",
  withdrawn: "辞退",
  rejected: "見送り",
};

export const applicationStatuses = Object.entries(applicationStatusLabels) as [
  ApplicationStatus,
  string,
][];

export const jobStatusLabels: Record<JobStatus, string> = {
  draft: "下書き",
  open: "募集中",
  paused: "募集停止",
  closed: "充足",
};

export const applicationFormSchema = z.object({
  job_id: z.string().min(1, "求人を選択してください。"),
  application_status: z.enum([
    "considering",
    "intention_confirming",
    "proposed",
    "applied",
    "document_screening",
    "first_interview",
    "second_interview",
    "final_interview",
    "offer",
    "accepted",
    "joined",
    "withdrawn",
    "rejected",
  ]),
  proposed_at: z.string(),
  applied_at: z.string(),
  next_event: z.string().trim(),
  next_event_at: z.string(),
  rejection_reason: z.string().trim(),
  withdrawal_reason: z.string().trim(),
  notes: z.string().trim(),
});

export type ApplicationFormValues = z.infer<typeof applicationFormSchema>;

export function toApplicationFormValues(
  application?: ApplicationRow,
): ApplicationFormValues {
  return {
    job_id: application?.job_id ?? "",
    application_status: application?.application_status ?? "proposed",
    proposed_at: application?.proposed_at?.slice(0, 16) ?? "",
    applied_at: application?.applied_at?.slice(0, 16) ?? "",
    next_event: application?.next_event ?? "",
    next_event_at: application?.next_event_at?.slice(0, 16) ?? "",
    rejection_reason: application?.rejection_reason ?? "",
    withdrawal_reason: application?.withdrawal_reason ?? "",
    notes: application?.notes ?? "",
  };
}

function emptyToNull(value: string): string | null {
  return value.trim() || null;
}

function dateTimeOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function toApplicationValues(
  candidateId: string,
  values: ApplicationFormValues,
): ApplicationInsert {
  return {
    candidate_id: candidateId,
    job_id: values.job_id,
    application_status: values.application_status,
    proposed_at: dateTimeOrNull(values.proposed_at),
    applied_at: dateTimeOrNull(values.applied_at),
    next_event: emptyToNull(values.next_event),
    next_event_at: dateTimeOrNull(values.next_event_at),
    rejection_reason: emptyToNull(values.rejection_reason),
    withdrawal_reason: emptyToNull(values.withdrawal_reason),
    notes: emptyToNull(values.notes),
  };
}
