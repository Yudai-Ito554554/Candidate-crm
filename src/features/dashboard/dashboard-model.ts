import { applicationStatusLabels } from "@/features/applications/application-model";
import { candidateStatusLabels } from "@/features/candidates/candidate-view";
import {
  activityTypeLabels,
  taskPriorityLabels,
  taskTypeLabels,
} from "@/features/work/work-model";
import { getLocalDateString } from "@/lib/format";
import type {
  ActivityRow,
  ApplicationRow,
  CandidateRow,
  CandidateViewRow,
  CompanyRow,
  EmailThreadRow,
  JobRow,
  TaskRow,
} from "@/types/database";

export interface DashboardSource {
  candidates: CandidateRow[];
  applications: ApplicationRow[];
  jobs: JobRow[];
  companies: CompanyRow[];
  activities: ActivityRow[];
  tasks: TaskRow[];
  emailThreads: EmailThreadRow[];
  candidateViews: CandidateViewRow[];
}

export interface DashboardAction {
  id: string;
  source: "task" | "activity";
  candidateId: string | null;
  candidateName: string;
  companyName: string;
  jobTitle: string;
  type: string;
  title: string;
  priority: string;
  timeLabel: string;
  overdue: boolean;
  occurredAt: string;
}

export interface DashboardAttention {
  label: string;
  count: number;
  detail: string;
  to: string;
  tone: string;
}

export interface DashboardRecentCandidate {
  id: string;
  name: string;
  occupation: string;
  status: string;
  nextActionDate: string | null;
  viewedAt: string;
}

export interface DashboardFeedItem {
  id: string;
  title: string;
  detail: string;
  occurredAt: string;
  to: string;
}

const activeSelectionStatuses = [
  "applied",
  "document_screening",
  "first_interview",
  "second_interview",
  "final_interview",
  "offer",
] as const;
const selectionResultWaitingStatuses = [
  "document_screening",
  "first_interview",
  "second_interview",
  "final_interview",
] as const;
const scheduledActivityTypes = [
  "meeting",
  "interview",
  "interview_scheduled",
  "phone",
] as const;

function isOneOf<T extends string>(value: string, values: readonly T[]) {
  return values.some((candidate) => candidate === value);
}

function dateOnly(value: string): string {
  return getLocalDateString(new Date(value));
}

function timeLabel(value: string, today: string, overdue: boolean): string {
  if (overdue) return `期限 ${dateOnly(value).replaceAll("-", "/")}`;
  if (dateOnly(value) !== today) return dateOnly(value).replaceAll("-", "/");
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function relatedNames(
  source: DashboardSource,
  candidateId: string | null,
  jobId: string | null,
) {
  const candidate = source.candidates.find((item) => item.id === candidateId);
  const job = source.jobs.find((item) => item.id === jobId);
  const company = source.companies.find((item) => item.id === job?.company_id);
  return {
    candidateName: candidate?.full_name ?? "-",
    companyName: company?.name ?? "-",
    jobTitle: job?.title ?? "-",
  };
}

export function getDashboardActions(
  source: DashboardSource,
  today = getLocalDateString(),
): DashboardAction[] {
  const taskActions = source.tasks
    .filter(
      (task) =>
        task.completed_at === null &&
        task.due_at !== null &&
        dateOnly(task.due_at) <= today,
    )
    .map((task): DashboardAction => {
      const overdue = dateOnly(task.due_at as string) < today;
      return {
        id: task.id,
        source: "task",
        candidateId: task.candidate_id,
        ...relatedNames(source, task.candidate_id, task.job_id),
        type: taskTypeLabels[task.task_type],
        title: task.title,
        priority: taskPriorityLabels[task.priority],
        timeLabel: timeLabel(task.due_at as string, today, overdue),
        overdue,
        occurredAt: task.due_at as string,
      };
    });

  const activityActions = source.activities
    .filter(
      (activity) =>
        dateOnly(activity.occurred_at) === today &&
        isOneOf(activity.activity_type, scheduledActivityTypes),
    )
    .map((activity): DashboardAction => ({
      id: activity.id,
      source: "activity",
      candidateId: activity.candidate_id,
      ...relatedNames(source, activity.candidate_id, activity.job_id),
      type: activityTypeLabels[activity.activity_type],
      title: activity.title,
      priority: "予定",
      timeLabel: timeLabel(activity.occurred_at, today, false),
      overdue: false,
      occurredAt: activity.occurred_at,
    }));

  return [...taskActions, ...activityActions].sort((left, right) =>
    left.occurredAt.localeCompare(right.occurredAt),
  );
}

export function getDashboardAttention(
  source: DashboardSource,
  today = getLocalDateString(),
): DashboardAttention[] {
  const overdueTasks = source.tasks.filter(
    (task) =>
      task.completed_at === null &&
      task.due_at !== null &&
      dateOnly(task.due_at) < today,
  );
  const candidateWaiting = source.candidates.filter(
    (candidate) => candidate.waiting_on === "candidate",
  );
  const companyWaiting = source.candidates.filter(
    (candidate) => candidate.waiting_on === "company",
  );
  const selectionWaiting = source.applications.filter((application) =>
    isOneOf(application.application_status, selectionResultWaitingStatuses),
  );
  const documentTasks = source.tasks.filter(
    (task) =>
      task.completed_at === null &&
      /書類|履歴書|職務経歴書/.test(`${task.title} ${task.description ?? ""}`),
  );

  const candidateLink = (
    candidateId: string | null | undefined,
    fallback: string,
  ) => (candidateId ? `/candidates/${candidateId}` : fallback);

  return [
    {
      label: "期限超過",
      count: overdueTasks.length,
      detail: overdueTasks[0]?.title ?? "期限超過はありません",
      to: candidateLink(overdueTasks[0]?.candidate_id, "/tasks"),
      tone: "text-rose-700 bg-rose-50",
    },
    {
      label: "候補者返信待ち",
      count: candidateWaiting.length,
      detail: candidateWaiting[0]?.next_action ?? "返信待ちはありません",
      to: candidateLink(candidateWaiting[0]?.id, "/candidates"),
      tone: "text-amber-800 bg-amber-50",
    },
    {
      label: "企業回答待ち",
      count: companyWaiting.length,
      detail: companyWaiting[0]?.next_action ?? "回答待ちはありません",
      to: candidateLink(companyWaiting[0]?.id, "/candidates"),
      tone: "text-blue-700 bg-blue-50",
    },
    {
      label: "選考結果待ち",
      count: selectionWaiting.length,
      detail: selectionWaiting[0]
        ? `${applicationStatusLabels[selectionWaiting[0].application_status]}の結果確認`
        : "結果待ちはありません",
      to: candidateLink(selectionWaiting[0]?.candidate_id, "/candidates"),
      tone: "text-violet-700 bg-violet-50",
    },
    {
      label: "書類待ち",
      count: documentTasks.length,
      detail: documentTasks[0]?.title ?? "書類待ちはありません",
      to: candidateLink(documentTasks[0]?.candidate_id, "/tasks"),
      tone: "text-slate-700 bg-slate-100",
    },
  ];
}

export function getRecentCandidates(
  candidates: CandidateRow[],
  views: CandidateViewRow[],
): DashboardRecentCandidate[] {
  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );
  return [...views]
    .sort((left, right) => right.viewed_at.localeCompare(left.viewed_at))
    .slice(0, 5)
    .flatMap((view) => {
      const candidate = candidatesById.get(view.candidate_id);
      if (!candidate) return [];
      return [
        {
          id: candidate.id,
          name: candidate.full_name,
          occupation:
            candidate.current_occupation ??
            candidate.current_job_title ??
            "未設定",
          status: candidateStatusLabels[candidate.candidate_status],
          nextActionDate: candidate.next_action_due_at,
          viewedAt: view.viewed_at,
        },
      ];
    });
}

export function getRecentFeed(source: DashboardSource): DashboardFeedItem[] {
  const activityItems = source.activities.map((activity) => {
    const names = relatedNames(source, activity.candidate_id, activity.job_id);
    return {
      id: `activity-${activity.id}`,
      title: activity.title,
      detail: `${names.candidateName} ・ ${activityTypeLabels[activity.activity_type]}`,
      occurredAt: activity.occurred_at,
      to: activity.candidate_id
        ? `/candidates/${activity.candidate_id}`
        : "/today",
    };
  });
  const emailItems = source.emailThreads.map((thread) => ({
    id: `email-${thread.id}`,
    title: thread.subject,
    detail: `${thread.last_sender_name ?? "送信者不明"} ・ ${thread.last_message_preview ?? "本文プレビューなし"}`,
    occurredAt: thread.last_message_at,
    to: "/inbox",
  }));
  return [...activityItems, ...emailItems]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .slice(0, 5);
}

export function getDashboardKpis(
  source: DashboardSource,
  today = getLocalDateString(),
) {
  const month = today.slice(0, 7);
  return [
    {
      label: "活動中候補者",
      value: source.candidates.filter(
        (candidate) =>
          !["joined", "closed"].includes(candidate.candidate_status),
      ).length,
    },
    {
      label: "選考中",
      value: source.applications.filter((application) =>
        isOneOf(application.application_status, activeSelectionStatuses),
      ).length,
    },
    {
      label: "今月の応募",
      value: source.applications.filter(
        (application) => application.applied_at?.slice(0, 7) === month,
      ).length,
    },
    {
      label: "今月の内定",
      value: source.applications.filter(
        (application) =>
          application.application_status === "accepted" &&
          application.updated_at.slice(0, 7) === month,
      ).length,
    },
  ];
}
