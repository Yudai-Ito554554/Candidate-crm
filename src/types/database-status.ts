import type {
  ActivityType as UiActivityType,
  ApplicationStatus as UiApplicationStatus,
  CandidateStatus as UiCandidateStatus,
  JobStatus as UiJobStatus,
  TaskPriority as UiTaskPriority,
  TaskType as UiTaskType,
} from "@/types";
import type {
  ActivityType,
  ApplicationStatus,
  CandidateStatus,
  DatabaseTaskPriority,
  DatabaseTaskType,
  JobStatus,
} from "@/types/database";

export const candidateStatusToDatabase = {
  新規: "new",
  初回連絡: "contacted",
  面談調整: "interview_scheduling",
  面談済み: "interviewed",
  求人提案: "job_proposed",
  応募意思確認: "intention_confirming",
  選考中: "active_selection",
  内定: "offered",
  入社: "joined",
  保留: "on_hold",
  終了: "closed",
} as const satisfies Record<UiCandidateStatus, CandidateStatus>;

export const applicationStatusToDatabase = {
  検討中: "considering",
  応募意思確認: "intention_confirming",
  応募済み: "applied",
  書類選考: "document_screening",
  一次面接: "first_interview",
  二次面接: "second_interview",
  最終面接: "final_interview",
  オファー: "offer",
  内定: "accepted",
  入社: "joined",
  辞退: "withdrawn",
  見送り: "rejected",
} as const satisfies Record<UiApplicationStatus, ApplicationStatus>;

export const jobStatusToDatabase = {
  募集中: "open",
  募集停止: "paused",
  充足: "closed",
} as const satisfies Record<UiJobStatus, JobStatus>;

export const taskPriorityToDatabase = {
  高: "high",
  中: "medium",
  低: "low",
} as const satisfies Record<UiTaskPriority, DatabaseTaskPriority>;

export const activityTypeToDatabase = {
  面談: "meeting",
  メール: "email_sent",
  電話: "phone",
  求人提案: "job_proposed",
  応募: "application",
  企業確認: "company_contact",
} as const satisfies Record<UiActivityType, ActivityType>;

export const taskTypeToDatabase = {
  候補者対応: "follow_up",
  企業確認: "follow_up",
  面談: "meeting",
  書類作成: "internal",
  選考確認: "selection",
  その他: "internal",
} as const satisfies Record<UiTaskType, DatabaseTaskType>;
