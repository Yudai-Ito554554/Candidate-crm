import { z } from "zod";

import type {
  ActivityRow,
  ActivityType,
  DatabaseTaskPriority,
  DatabaseTaskType,
  TaskRow,
  WaitingOn,
} from "@/types/database";

export const activityTypeLabels: Record<ActivityType, string> = {
  interview: "面談",
  phone: "電話",
  email_sent: "メール送信",
  email_received: "メール受信",
  job_proposed: "求人提案",
  intention_confirmed: "応募意思確認",
  application: "応募",
  document_submitted: "書類提出",
  company_contact: "企業確認",
  interview_scheduled: "面接",
  meeting: "ミーティング",
  selection_result: "選考結果",
  task: "タスク作成",
  note: "メモ",
};
export const activityTypes = Object.entries(activityTypeLabels) as [
  ActivityType,
  string,
][];
export const taskTypeLabels: Record<DatabaseTaskType, string> = {
  follow_up: "フォローアップ",
  call: "電話",
  email: "メール",
  meeting: "面談",
  proposal: "求人提案",
  selection: "選考確認",
  internal: "社内作業",
};
export const taskPriorityLabels: Record<DatabaseTaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "緊急",
};
export const waitingOnLabels: Record<WaitingOn, string> = {
  self: "自分待ち",
  candidate: "候補者待ち",
  company: "企業待ち",
  none: "待ちなし",
};

export const activityFormSchema = z.object({
  activity_type: z.enum([
    "interview",
    "phone",
    "email_sent",
    "email_received",
    "job_proposed",
    "intention_confirmed",
    "application",
    "document_submitted",
    "company_contact",
    "interview_scheduled",
    "meeting",
    "selection_result",
    "task",
    "note",
  ]),
  occurred_at: z.string().min(1, "日時を入力してください。"),
  title: z.string().trim().min(1, "タイトルを入力してください。"),
  body: z.string().trim(),
  direction: z.enum(["inbound", "outbound", "internal", "none"]),
  job_id: z.string(),
  application_id: z.string(),
});
export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export const taskFormSchema = z.object({
  candidate_id: z.string(),
  job_id: z.string(),
  application_id: z.string(),
  task_type: z.enum([
    "follow_up",
    "call",
    "email",
    "meeting",
    "proposal",
    "selection",
    "internal",
  ]),
  title: z.string().trim().min(1, "タスク内容を入力してください。"),
  description: z.string().trim(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_at: z.string(),
  waiting_on: z.enum(["self", "candidate", "company", "none"]),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;

const emptyToNull = (value: string) => value.trim() || null;
const dateTimeOrNull = (value: string) =>
  value ? new Date(value).toISOString() : null;

export function toActivityFormValues(
  activity?: ActivityRow,
): ActivityFormValues {
  return {
    activity_type: activity?.activity_type ?? "note",
    occurred_at:
      activity?.occurred_at.slice(0, 16) ??
      new Date().toISOString().slice(0, 16),
    title: activity?.title ?? "",
    body: activity?.body ?? "",
    direction: activity?.direction ?? "internal",
    job_id: activity?.job_id ?? "",
    application_id: activity?.application_id ?? "",
  };
}
export function toActivityValues(
  candidateId: string,
  ownerId: string | null,
  values: ActivityFormValues,
) {
  return {
    owner_id: ownerId,
    candidate_id: candidateId,
    job_id: emptyToNull(values.job_id),
    application_id: emptyToNull(values.application_id),
    activity_type: values.activity_type,
    occurred_at: new Date(values.occurred_at).toISOString(),
    title: values.title.trim(),
    body: emptyToNull(values.body),
    direction: values.direction,
    ai_generated: false,
    metadata: {},
  };
}
export function toTaskFormValues(
  task?: TaskRow,
  candidateId = "",
): TaskFormValues {
  return {
    candidate_id: task?.candidate_id ?? candidateId,
    job_id: task?.job_id ?? "",
    application_id: task?.application_id ?? "",
    task_type: task?.task_type ?? "follow_up",
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "medium",
    due_at: task?.due_at?.slice(0, 16) ?? "",
    waiting_on: task?.waiting_on ?? "none",
  };
}
export function toTaskValues(ownerId: string | null, values: TaskFormValues) {
  return {
    owner_id: ownerId,
    candidate_id: emptyToNull(values.candidate_id),
    job_id: emptyToNull(values.job_id),
    application_id: emptyToNull(values.application_id),
    task_type: values.task_type,
    title: values.title.trim(),
    description: emptyToNull(values.description),
    priority: values.priority,
    due_at: dateTimeOrNull(values.due_at),
    waiting_on: values.waiting_on,
  };
}
