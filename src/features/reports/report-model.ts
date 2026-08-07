import type {
  ActivityRow,
  ApplicationRow,
  ApplicationStatusHistoryRow,
  CandidateRow,
  CandidateStatus,
} from "@/types/database";

export interface ReportSource {
  candidates: CandidateRow[];
  applications: ApplicationRow[];
  activities: ActivityRow[];
  applicationStatusHistory: ApplicationStatusHistoryRow[];
}

export interface ReportMetric {
  label: string;
  value: number;
  previous: number;
}

export interface ReportStage {
  label: string;
  value: number;
}

export interface ReportFunnelRow {
  label: string;
  value: number;
  rate: string;
}

interface MonthRange {
  key: string;
  previousKey: string;
}

const stageStatuses: Array<{
  label: string;
  statuses: CandidateStatus[];
}> = [
  { label: "新規・初回連絡", statuses: ["new", "contacted"] },
  { label: "面談前", statuses: ["interview_scheduling"] },
  { label: "面談済み", statuses: ["interviewed"] },
  { label: "求人提案", statuses: ["job_proposed"] },
  { label: "応募調整", statuses: ["intention_confirming"] },
  { label: "選考中", statuses: ["active_selection"] },
  { label: "内定", statuses: ["offered"] },
  { label: "入社", statuses: ["joined"] },
  { label: "保留", statuses: ["on_hold"] },
];

function getMonthRange(month: string): MonthRange {
  const [year, monthNumber] = month.split("-").map(Number);
  const previous = new Date(year, monthNumber - 2, 1);
  return {
    key: month,
    previousKey: `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`,
  };
}

function isInMonth(value: string | null, month: string) {
  return value?.slice(0, 7) === month;
}

function countApplicationStagePasses(
  statusHistory: ApplicationStatusHistoryRow[],
  month: string,
) {
  return statusHistory.filter(
    (history) =>
      !history.is_backfilled &&
      history.from_status === "document_screening" &&
      !["withdrawn", "rejected"].includes(history.to_status) &&
      isInMonth(history.changed_at, month),
  ).length;
}

function countInterviews(activities: ActivityRow[], month: string) {
  return activities.filter(
    (activity) =>
      isInMonth(activity.occurred_at, month) &&
      ["interview", "interview_scheduled"].includes(activity.activity_type),
  ).length;
}

function countMeetings(activities: ActivityRow[], month: string) {
  return activities.filter(
    (activity) =>
      isInMonth(activity.occurred_at, month) &&
      ["meeting", "phone"].includes(activity.activity_type),
  ).length;
}

function valuesForMonth(source: ReportSource, month: string) {
  return {
    newCandidates: source.candidates.filter((candidate) =>
      isInMonth(candidate.created_at, month),
    ).length,
    meetings: countMeetings(source.activities, month),
    proposals: source.applications.filter((application) =>
      isInMonth(application.proposed_at, month),
    ).length,
    applications: source.applications.filter((application) =>
      isInMonth(application.applied_at, month),
    ).length,
    documentPasses: countApplicationStagePasses(
      source.applicationStatusHistory,
      month,
    ),
    interviews: countInterviews(source.activities, month),
    offers: source.applicationStatusHistory.filter(
      (history) =>
        !history.is_backfilled &&
        history.to_status === "accepted" &&
        isInMonth(history.changed_at, month),
    ).length,
    joins: source.applications.filter((application) =>
      isInMonth(application.joined_on, month),
    ).length,
  };
}

export function getReportMetrics(
  source: ReportSource,
  month: string,
): ReportMetric[] {
  const range = getMonthRange(month);
  const current = valuesForMonth(source, range.key);
  const previous = valuesForMonth(source, range.previousKey);
  return [
    {
      label: "新規候補者",
      value: current.newCandidates,
      previous: previous.newCandidates,
    },
    {
      label: "面談・電話",
      value: current.meetings,
      previous: previous.meetings,
    },
    {
      label: "求人提案",
      value: current.proposals,
      previous: previous.proposals,
    },
    {
      label: "応募",
      value: current.applications,
      previous: previous.applications,
    },
    {
      label: "書類通過",
      value: current.documentPasses,
      previous: previous.documentPasses,
    },
    { label: "面接", value: current.interviews, previous: previous.interviews },
    { label: "内定", value: current.offers, previous: previous.offers },
    { label: "入社", value: current.joins, previous: previous.joins },
  ];
}

export function getReportStages(candidates: CandidateRow[]): ReportStage[] {
  return stageStatuses.map((stage) => ({
    label: stage.label,
    value: candidates.filter((candidate) =>
      stage.statuses.includes(candidate.candidate_status),
    ).length,
  }));
}

function conversionRate(current: number, previous: number): string {
  if (previous === 0) return "-";
  return `${Math.round((current / previous) * 100)}%`;
}

export function getReportFunnel(
  source: ReportSource,
  month: string,
): ReportFunnelRow[] {
  const values = valuesForMonth(source, month);
  const rows = [
    { label: "求人提案", value: values.proposals },
    { label: "応募", value: values.applications },
    { label: "書類通過", value: values.documentPasses },
    { label: "面接", value: values.interviews },
    { label: "内定", value: values.offers },
  ];
  return rows.map((row, index) => ({
    ...row,
    rate: index === 0 ? "-" : conversionRate(row.value, rows[index - 1].value),
  }));
}

export function formatReportMonth(month: string) {
  const [year, monthNumber] = month.split("-");
  return `${year}年${Number(monthNumber)}月`;
}
