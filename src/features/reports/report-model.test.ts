import {
  formatReportMonth,
  getReportFunnel,
  getReportMetrics,
  getReportStages,
  type ReportSource,
} from "@/features/reports/report-model";
import type {
  ActivityRow,
  ApplicationRow,
  ApplicationStatusHistoryRow,
  CandidateRow,
} from "@/types/database";

const candidates = [
  {
    id: "candidate-1",
    candidate_status: "active_selection",
    created_at: "2026-08-02T00:00:00Z",
  },
  {
    id: "candidate-2",
    candidate_status: "new",
    created_at: "2026-07-02T00:00:00Z",
  },
] as CandidateRow[];

const applications = [
  {
    id: "application-1",
    application_status: "first_interview",
    proposed_at: "2026-08-02T00:00:00Z",
    applied_at: "2026-08-03T00:00:00Z",
    joined_on: null,
    updated_at: "2026-08-04T00:00:00Z",
  },
  {
    id: "application-2",
    application_status: "accepted",
    proposed_at: "2026-07-02T00:00:00Z",
    applied_at: "2026-07-03T00:00:00Z",
    joined_on: null,
    updated_at: "2026-07-20T00:00:00Z",
  },
] as ApplicationRow[];

const activities = [
  {
    id: "activity-1",
    activity_type: "meeting",
    occurred_at: "2026-08-03T00:00:00Z",
  },
  {
    id: "activity-2",
    activity_type: "interview_scheduled",
    occurred_at: "2026-08-04T00:00:00Z",
  },
] as ActivityRow[];

const applicationStatusHistory = [
  {
    id: "history-1",
    application_id: "application-1",
    from_status: "document_screening",
    to_status: "first_interview",
    changed_by: "user-1",
    is_backfilled: false,
    changed_at: "2026-08-04T00:00:00Z",
  },
  {
    id: "history-2",
    application_id: "application-2",
    from_status: "offer",
    to_status: "accepted",
    changed_by: "user-1",
    is_backfilled: false,
    changed_at: "2026-07-20T00:00:00Z",
  },
  {
    id: "history-3",
    application_id: "application-2",
    from_status: null,
    to_status: "accepted",
    changed_by: "user-1",
    is_backfilled: true,
    changed_at: "2026-08-01T00:00:00Z",
  },
] as ApplicationStatusHistoryRow[];

const source: ReportSource = {
  candidates,
  applications,
  activities,
  applicationStatusHistory,
};

describe("report model", () => {
  it("当月と前月の活動指標を集計する", () => {
    expect(getReportMetrics(source, "2026-08")).toEqual([
      { label: "新規候補者", value: 1, previous: 1 },
      { label: "面談・電話", value: 1, previous: 0 },
      { label: "求人提案", value: 1, previous: 1 },
      { label: "応募", value: 1, previous: 1 },
      { label: "書類通過", value: 1, previous: 0 },
      { label: "面接", value: 1, previous: 0 },
      { label: "内定", value: 0, previous: 1 },
      { label: "入社", value: 0, previous: 0 },
    ]);
  });

  it("候補者の現在ステージと月次ファネルを作成する", () => {
    expect(getReportStages(candidates)).toEqual(
      expect.arrayContaining([
        { label: "新規・初回連絡", value: 1 },
        { label: "選考中", value: 1 },
      ]),
    );
    expect(getReportFunnel(source, "2026-08")).toEqual([
      { label: "求人提案", value: 1, rate: "-" },
      { label: "応募", value: 1, rate: "100%" },
      { label: "書類通過", value: 1, rate: "100%" },
      { label: "面接", value: 1, rate: "100%" },
      { label: "内定", value: 0, rate: "0%" },
    ]);
  });

  it("集計月を日本語表示する", () => {
    expect(formatReportMonth("2026-08")).toBe("2026年8月");
  });
});
