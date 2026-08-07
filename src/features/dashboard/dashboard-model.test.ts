import {
  getDashboardActions,
  getDashboardAttention,
  getDashboardKpis,
  getRecentCandidates,
  getRecentFeed,
  type DashboardSource,
} from "@/features/dashboard/dashboard-model";
import type {
  ActivityRow,
  ApplicationRow,
  CandidateRow,
  CompanyRow,
  EmailThreadRow,
  JobRow,
  TaskRow,
} from "@/types/database";

const timestamps = {
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-06T01:00:00Z",
};

const candidate: CandidateRow = {
  ...timestamps,
  id: "candidate-1",
  owner_id: "user-1",
  full_name: "佐藤 健太",
  full_name_kana: null,
  email: null,
  phone: null,
  birth_date: null,
  prefecture: "東京都",
  current_company: "メディカル社",
  current_department: null,
  current_job_title: null,
  current_occupation: "医療機器営業",
  candidate_status: "active_selection",
  desired_occupations: [],
  desired_locations: [],
  current_salary_min: null,
  current_salary_max: null,
  desired_salary_min: null,
  desired_salary_max: null,
  available_from: null,
  reason_for_change: null,
  priority_conditions: null,
  strengths: null,
  concerns: null,
  interview_summary: null,
  next_action: "一次面接の結果確認",
  next_action_due_at: "2026-08-06T03:00:00Z",
  waiting_on: "company",
  last_contacted_at: null,
  source: null,
  private_notes: null,
  archived_at: null,
};

const company: CompanyRow = {
  ...timestamps,
  id: "company-1",
  name: "メディカル社",
  name_kana: null,
  industry: "医療機器",
  employees: null,
  capital: null,
  listed: null,
  website: null,
  address: null,
  notes: null,
  archived_at: null,
};

const job: JobRow = {
  ...timestamps,
  id: "job-1",
  company_id: company.id,
  contact_id: null,
  owner_id: "user-1",
  title: "循環器領域 営業",
  division: null,
  occupation: "医療機器営業",
  employment_type: null,
  locations: ["東京都"],
  salary_min: null,
  salary_max: null,
  job_status: "open",
  required_conditions: null,
  preferred_conditions: null,
  description: null,
  internal_notes: null,
  opened_at: null,
  closed_at: null,
  archived_at: null,
};

const application: ApplicationRow = {
  ...timestamps,
  id: "application-1",
  candidate_id: candidate.id,
  job_id: job.id,
  owner_id: "user-1",
  application_status: "first_interview",
  proposed_at: "2026-08-01T00:00:00Z",
  applied_at: "2026-08-02T00:00:00Z",
  next_event: "結果確認",
  next_event_at: null,
  rejection_reason: null,
  withdrawal_reason: null,
  offered_salary: null,
  joined_on: null,
  notes: null,
  archived_at: null,
};

const activity: ActivityRow = {
  ...timestamps,
  id: "activity-1",
  owner_id: "user-1",
  candidate_id: candidate.id,
  company_id: company.id,
  job_id: job.id,
  application_id: application.id,
  activity_type: "meeting",
  occurred_at: "2026-08-06T05:00:00Z",
  title: "キャリア面談",
  body: null,
  direction: "internal",
  external_message_id: null,
  ai_generated: false,
  metadata: {},
  archived_at: null,
};

const task: TaskRow = {
  ...timestamps,
  id: "task-1",
  owner_id: "user-1",
  candidate_id: candidate.id,
  company_id: company.id,
  job_id: job.id,
  application_id: application.id,
  task_type: "selection",
  title: "職務経歴書を企業へ提出",
  description: null,
  priority: "high",
  due_at: "2026-08-05T03:00:00Z",
  completed_at: null,
  waiting_on: "self",
  archived_at: null,
};

const emailThread: EmailThreadRow = {
  ...timestamps,
  id: "thread-1",
  owner_id: "user-1",
  candidate_id: candidate.id,
  company_id: company.id,
  job_id: job.id,
  application_id: application.id,
  provider: "manual",
  external_thread_id: null,
  subject: "面接日程について",
  participant_type: "candidate",
  status: "unhandled",
  has_ai_draft: false,
  last_sender_name: "佐藤 健太",
  last_message_preview: "候補日をお送りします。",
  last_message_at: "2026-08-06T06:00:00Z",
  archived_at: null,
};

const source: DashboardSource = {
  candidates: [candidate],
  applications: [application],
  jobs: [job],
  companies: [company],
  activities: [activity],
  tasks: [task],
  emailThreads: [emailThread],
  candidateViews: [
    {
      user_id: "user-1",
      candidate_id: candidate.id,
      viewed_at: "2026-08-06T07:00:00Z",
      created_at: "2026-08-06T07:00:00Z",
    },
  ],
};

describe("dashboard model", () => {
  it("今日の予定と期限超過タスクを関連情報付きで集約する", () => {
    const actions = getDashboardActions(source, "2026-08-06");

    expect(actions).toHaveLength(2);
    expect(actions[0]).toMatchObject({
      source: "task",
      candidateName: "佐藤 健太",
      companyName: "メディカル社",
      overdue: true,
    });
    expect(actions[1]).toMatchObject({
      source: "activity",
      title: "キャリア面談",
    });
  });

  it("要対応を実データから分類する", () => {
    const attention = getDashboardAttention(source, "2026-08-06");

    expect(attention.find((item) => item.label === "期限超過")?.count).toBe(1);
    expect(attention.find((item) => item.label === "企業回答待ち")?.count).toBe(
      1,
    );
    expect(attention.find((item) => item.label === "選考結果待ち")?.count).toBe(
      1,
    );
    expect(attention.find((item) => item.label === "書類待ち")?.count).toBe(1);
  });

  it("閲覧候補者、最近の活動、KPIを作成する", () => {
    expect(
      getRecentCandidates(source.candidates, source.candidateViews)[0],
    ).toMatchObject({
      name: "佐藤 健太",
      status: "選考中",
      viewedAt: "2026-08-06T07:00:00Z",
    });
    expect(getRecentFeed(source)[0]).toMatchObject({
      title: "面接日程について",
      to: "/inbox",
    });
    expect(getDashboardKpis(source, "2026-08-06")).toEqual([
      { label: "活動中候補者", value: 1 },
      { label: "選考中", value: 1 },
      { label: "今月の応募", value: 1 },
      { label: "今月の内定", value: 0 },
    ]);
  });
});
