import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import { AuthProvider } from "@/features/auth/auth-provider";
import { appRoutes } from "@/router";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

const candidateMocks = vi.hoisted(() => ({
  listCandidates: vi.fn(),
  listArchivedCandidates: vi.fn(),
  listCandidateViews: vi.fn(),
  recordCandidateView: vi.fn(),
  getCandidate: vi.fn(),
  createCandidate: vi.fn(),
  updateCandidate: vi.fn(),
  archiveCandidate: vi.fn(),
  restoreCandidate: vi.fn(),
  completeCandidateNextAction: vi.fn(),
  listCandidateExperiences: vi.fn(),
  createCandidateExperience: vi.fn(),
  updateCandidateExperience: vi.fn(),
  archiveCandidateExperience: vi.fn(),
  listProfiles: vi.fn(),
  updateOwnProfile: vi.fn(),
  setProfileRole: vi.fn(),
  inviteUser: vi.fn(),
  listCandidateAiSummaries: vi.fn(),
  reviewAiSummary: vi.fn(),
  generateCandidateSummary: vi.fn(),
  extractJobPosting: vi.fn(),
  listApplications: vi.fn(),
  listApplicationStatusHistory: vi.fn(),
  createApplication: vi.fn(),
  updateApplication: vi.fn(),
  archiveApplication: vi.fn(),
  listJobs: vi.fn(),
  listArchivedJobs: vi.fn(),
  listCompanies: vi.fn(),
  listArchivedCompanies: vi.fn(),
  listCompanyContacts: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  archiveCompany: vi.fn(),
  restoreCompany: vi.fn(),
  createCompanyContact: vi.fn(),
  updateCompanyContact: vi.fn(),
  archiveCompanyContact: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  archiveJob: vi.fn(),
  restoreJob: vi.fn(),
  listActivities: vi.fn(),
  listCandidateActivities: vi.fn(),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  archiveActivity: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  archiveTask: vi.fn(),
  listCandidateFiles: vi.fn(),
  listCompanyFiles: vi.fn(),
  listJobFiles: vi.fn(),
  uploadCrmFile: vi.fn(),
  archiveFile: vi.fn(),
  downloadCrmFile: vi.fn(),
  listEmailThreads: vi.fn(),
  listEmailMessages: vi.fn(),
  updateEmailThreadStatus: vi.fn(),
  listTags: vi.fn(),
  listCandidateTags: vi.fn(),
  listCompanyTags: vi.fn(),
  listJobTags: vi.fn(),
  createTag: vi.fn(),
  attachCandidateTag: vi.fn(),
  archiveCandidateTag: vi.fn(),
  attachCompanyTag: vi.fn(),
  archiveCompanyTag: vi.fn(),
  attachJobTag: vi.fn(),
  archiveJobTag: vi.fn(),
  searchCrm: vi.fn(),
  listAuditLogs: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  environment: {
    success: true,
    data: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
  },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(() => Promise.resolve({ auth: authMocks })),
}));

vi.mock("@/services/candidates-repository", () => ({
  listCandidates: candidateMocks.listCandidates,
  listArchivedCandidates: candidateMocks.listArchivedCandidates,
  listCandidateViews: candidateMocks.listCandidateViews,
  recordCandidateView: candidateMocks.recordCandidateView,
  getCandidate: candidateMocks.getCandidate,
  createCandidate: candidateMocks.createCandidate,
  updateCandidate: candidateMocks.updateCandidate,
  archiveCandidate: candidateMocks.archiveCandidate,
  restoreCandidate: candidateMocks.restoreCandidate,
  completeCandidateNextAction: candidateMocks.completeCandidateNextAction,
  listCandidateExperiences: candidateMocks.listCandidateExperiences,
  createCandidateExperience: candidateMocks.createCandidateExperience,
  updateCandidateExperience: candidateMocks.updateCandidateExperience,
  archiveCandidateExperience: candidateMocks.archiveCandidateExperience,
}));

vi.mock("@/services/profiles-repository", () => ({
  listProfiles: candidateMocks.listProfiles,
  updateOwnProfile: candidateMocks.updateOwnProfile,
  setProfileRole: candidateMocks.setProfileRole,
}));

vi.mock("@/services/user-invitations-repository", () => ({
  inviteUser: candidateMocks.inviteUser,
}));

vi.mock("@/services/ai-summaries-repository", () => ({
  listCandidateAiSummaries: candidateMocks.listCandidateAiSummaries,
  reviewAiSummary: candidateMocks.reviewAiSummary,
}));

vi.mock("@/services/ai-generation-repository", () => ({
  generateCandidateSummary: candidateMocks.generateCandidateSummary,
}));

vi.mock("@/services/job-import-repository", () => ({
  extractJobPosting: candidateMocks.extractJobPosting,
}));

vi.mock("@/services/applications-repository", () => ({
  listApplications: candidateMocks.listApplications,
  listApplicationStatusHistory: candidateMocks.listApplicationStatusHistory,
  createApplication: candidateMocks.createApplication,
  updateApplication: candidateMocks.updateApplication,
  archiveApplication: candidateMocks.archiveApplication,
}));

vi.mock("@/services/jobs-repository", () => ({
  listJobs: candidateMocks.listJobs,
  listArchivedJobs: candidateMocks.listArchivedJobs,
  createJob: candidateMocks.createJob,
  updateJob: candidateMocks.updateJob,
  archiveJob: candidateMocks.archiveJob,
  restoreJob: candidateMocks.restoreJob,
}));

vi.mock("@/services/companies-repository", () => ({
  listCompanies: candidateMocks.listCompanies,
  listArchivedCompanies: candidateMocks.listArchivedCompanies,
  listCompanyContacts: candidateMocks.listCompanyContacts,
  createCompany: candidateMocks.createCompany,
  updateCompany: candidateMocks.updateCompany,
  archiveCompany: candidateMocks.archiveCompany,
  restoreCompany: candidateMocks.restoreCompany,
  createCompanyContact: candidateMocks.createCompanyContact,
  updateCompanyContact: candidateMocks.updateCompanyContact,
  archiveCompanyContact: candidateMocks.archiveCompanyContact,
}));

vi.mock("@/services/activities-repository", () => ({
  listActivities: candidateMocks.listActivities,
  listCandidateActivities: candidateMocks.listCandidateActivities,
  createActivity: candidateMocks.createActivity,
  updateActivity: candidateMocks.updateActivity,
  archiveActivity: candidateMocks.archiveActivity,
}));

vi.mock("@/services/tasks-repository", () => ({
  listTasks: candidateMocks.listTasks,
  createTask: candidateMocks.createTask,
  updateTask: candidateMocks.updateTask,
  archiveTask: candidateMocks.archiveTask,
}));

vi.mock("@/services/files-repository", () => ({
  listCandidateFiles: candidateMocks.listCandidateFiles,
  listCompanyFiles: candidateMocks.listCompanyFiles,
  listJobFiles: candidateMocks.listJobFiles,
  uploadCrmFile: candidateMocks.uploadCrmFile,
  archiveFile: candidateMocks.archiveFile,
  downloadCrmFile: candidateMocks.downloadCrmFile,
}));

vi.mock("@/services/email-repository", () => ({
  listEmailThreads: candidateMocks.listEmailThreads,
  listEmailMessages: candidateMocks.listEmailMessages,
  updateEmailThreadStatus: candidateMocks.updateEmailThreadStatus,
}));

vi.mock("@/services/tags-repository", () => ({
  listTags: candidateMocks.listTags,
  listCandidateTags: candidateMocks.listCandidateTags,
  listCompanyTags: candidateMocks.listCompanyTags,
  listJobTags: candidateMocks.listJobTags,
  createTag: candidateMocks.createTag,
  attachCandidateTag: candidateMocks.attachCandidateTag,
  archiveCandidateTag: candidateMocks.archiveCandidateTag,
  attachCompanyTag: candidateMocks.attachCompanyTag,
  archiveCompanyTag: candidateMocks.archiveCompanyTag,
  attachJobTag: candidateMocks.attachJobTag,
  archiveJobTag: candidateMocks.archiveJobTag,
}));

vi.mock("@/services/search-repository", () => ({
  searchCrm: candidateMocks.searchCrm,
}));

vi.mock("@/services/audit-logs-repository", () => ({
  listAuditLogs: candidateMocks.listAuditLogs,
}));

const authenticatedSession = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "user-001",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-08-04T00:00:00Z",
    email: "agent@example.com",
  },
} as Session;

const databaseCandidate = {
  id: "c-001",
  owner_id: "user-001",
  full_name: "佐藤 健太",
  full_name_kana: "サトウ ケンタ",
  email: "kenta@example.com",
  phone: "090-0000-0001",
  birth_date: "1988-04-10",
  prefecture: "東京都",
  current_company: "メディカルデバイス株式会社",
  current_department: "営業部",
  current_job_title: "主任",
  current_occupation: "医療機器営業",
  candidate_status: "active_selection",
  desired_occupations: ["医療機器営業"],
  desired_locations: ["東京都"],
  current_salary_min: 650,
  current_salary_max: 700,
  desired_salary_min: 750,
  desired_salary_max: 850,
  available_from: "2026-10-01",
  reason_for_change: "専門性を高めたい",
  priority_conditions: "製品力、年収",
  strengths: "医師との関係構築",
  concerns: "英語面接",
  interview_summary: "循環器領域の経験が豊富",
  next_action: "一次面接の日程確認",
  next_action_due_at: "2026-08-06T09:00:00Z",
  waiting_on: "company",
  last_contacted_at: "2026-08-04T03:00:00Z",
  source: "紹介",
  private_notes: "社内限定",
  archived_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-04T00:00:00Z",
} as const;

const databaseCandidateView = {
  user_id: "user-001",
  candidate_id: "c-001",
  viewed_at: "2026-08-06T08:30:00Z",
  created_at: "2026-08-06T08:30:00Z",
} as const;

const databaseExperience = {
  id: "exp-001",
  candidate_id: "c-001",
  company_name: "メディカルデバイス株式会社",
  department: "営業部",
  job_title: "主任",
  occupation: "医療機器営業",
  started_on: "2021-04-01",
  ended_on: null,
  is_current: true,
  experience_domain: "循環器",
  responsibilities: "基幹病院への提案営業",
  achievements: "年間目標を120%達成",
  sort_order: 0,
  archived_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-04T00:00:00Z",
} as const;

const databaseJob = {
  id: "j-001",
  company_id: "company-001",
  contact_id: "contact-001",
  owner_id: "user-001",
  title: "TAVI製品 営業担当",
  division: "循環器事業部",
  occupation: "医療機器営業",
  employment_type: "正社員",
  locations: ["東京都"],
  salary_min: 700,
  salary_max: 900,
  job_status: "open",
  required_conditions: "医療業界での営業経験",
  preferred_conditions: "循環器領域の経験",
  description: "医療機関への製品提案",
  internal_notes: "社内限定メモ",
  opened_at: "2026-08-01",
  closed_at: null,
  archived_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-04T00:00:00Z",
} as const;

const databaseApplication = {
  id: "application-001",
  candidate_id: "c-001",
  job_id: "j-001",
  owner_id: "user-001",
  application_status: "proposed",
  proposed_at: "2026-08-04T09:00:00Z",
  applied_at: null,
  next_event: "応募意思確認",
  next_event_at: "2026-08-06T09:00:00Z",
  rejection_reason: null,
  withdrawal_reason: null,
  offered_salary: null,
  joined_on: null,
  notes: null,
  archived_at: null,
  created_at: "2026-08-04T09:00:00Z",
  updated_at: "2026-08-04T09:00:00Z",
} as const;

const databaseApplicationStatusHistory = {
  id: "application-history-001",
  application_id: "application-001",
  from_status: null,
  to_status: "proposed",
  changed_by: "user-001",
  is_backfilled: true,
  changed_at: "2026-08-04T09:00:00Z",
} as const;

const databaseCompany = {
  id: "company-001",
  name: "メディカルデバイス株式会社",
  name_kana: null,
  industry: "医療機器",
  employees: 500,
  capital: 100000000,
  listed: false,
  website: null,
  address: "東京都",
  notes: null,
  archived_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
} as const;

const databaseContact = {
  id: "contact-001",
  company_id: "company-001",
  full_name: "佐々木 亮",
  department: "人事部",
  position: "採用担当",
  email: null,
  phone: null,
  notes: null,
  archived_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
} as const;

const databaseActivity = {
  id: "activity-001",
  owner_id: "user-001",
  candidate_id: "c-001",
  company_id: "company-001",
  job_id: "j-001",
  application_id: "application-001",
  activity_type: "meeting",
  occurred_at: "2026-08-06T10:00:00Z",
  title: "初回キャリア面談（Zoom）",
  body: "希望条件を確認",
  direction: "internal",
  external_message_id: null,
  ai_generated: false,
  metadata: {},
  archived_at: null,
  created_at: "2026-08-06T10:00:00Z",
  updated_at: "2026-08-06T10:00:00Z",
} as const;

const databaseAiSummary = {
  id: "ai-summary-001",
  candidate_id: "c-001",
  generated_by: null,
  model: "server-model-001",
  prompt_version: "candidate-summary-v1",
  candidate_summary: "医療機器営業として循環器領域の経験を持つ候補者です。",
  change_reason_summary: "専門性を活かしながら担当領域を広げたい意向です。",
  strengths: "医師との関係構築力と製品導入支援の経験",
  concerns: "マネジメント経験は面談で追加確認が必要です。",
  interview_questions: "希望する担当領域と転勤可否を確認する。",
  recommended_jobs: "TAVI製品 営業担当",
  next_action: "循環器領域の求人を提案する。",
  email_draft: "佐藤様\nご経験に合う求人をご案内します。",
  source_activity_through_at: "2026-08-06T10:00:00Z",
  generated_at: "2026-08-06T11:00:00Z",
  reviewed_by: null,
  reviewed_at: null,
  archived_at: null,
  created_at: "2026-08-06T11:00:00Z",
} as const;

const databaseTask = {
  id: "task-001",
  owner_id: "user-001",
  candidate_id: "c-001",
  company_id: "company-001",
  job_id: "j-001",
  application_id: "application-001",
  task_type: "follow_up",
  title: "候補者へ面談後フォロー",
  description: null,
  priority: "high",
  due_at: "2026-08-06T11:00:00Z",
  completed_at: null,
  waiting_on: "self",
  archived_at: null,
  created_at: "2026-08-05T00:00:00Z",
  updated_at: "2026-08-05T00:00:00Z",
} as const;

const databaseFile = {
  id: "file-001",
  owner_id: "user-001",
  candidate_id: "c-001",
  company_id: null,
  job_id: null,
  application_id: null,
  file_name: "佐藤健太_履歴書.pdf",
  storage_path: "user-001/candidates/c-001/file-001.pdf",
  mime_type: "application/pdf",
  file_size: 128000,
  category: "resume",
  archived_at: null,
  created_at: "2026-08-06T09:00:00Z",
  updated_at: "2026-08-06T09:00:00Z",
} as const;

const databaseEmailThread = {
  id: "email-thread-001",
  owner_id: "user-001",
  candidate_id: "c-001",
  company_id: "company-001",
  job_id: "j-001",
  application_id: "application-001",
  provider: "gmail",
  external_thread_id: "gmail-thread-001",
  subject: "一次面接後の追加確認について",
  participant_type: "candidate",
  status: "unhandled",
  has_ai_draft: true,
  last_sender_name: "佐藤 健太",
  last_message_preview: "担当製品について追加で確認できますでしょうか。",
  last_message_at: "2026-08-06T09:15:00Z",
  archived_at: null,
  created_at: "2026-08-06T09:15:00Z",
  updated_at: "2026-08-06T09:15:00Z",
} as const;

const databaseEmailMessages = [
  {
    id: "email-message-001",
    thread_id: "email-thread-001",
    activity_id: "activity-001",
    external_message_id: "gmail-message-001",
    direction: "inbound",
    sender_name: "佐藤 健太",
    sender_email: "kenta@example.com",
    recipient_emails: ["agent@example.com"],
    cc_emails: [],
    body_text: "担当製品と営業エリアについて確認できますでしょうか。",
    sent_at: "2026-08-06T09:15:00Z",
    has_attachments: false,
    ai_generated: false,
    created_at: "2026-08-06T09:15:00Z",
    updated_at: "2026-08-06T09:15:00Z",
  },
] as const;

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("Candidate CRM Phase 2.5 routes", () => {
  beforeEach(() => {
    authMocks.getSession.mockResolvedValue({
      data: { session: authenticatedSession },
      error: null,
    });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.signInWithPassword.mockResolvedValue({
      data: { session: authenticatedSession, user: authenticatedSession.user },
      error: null,
    });
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });
    authMocks.updateUser.mockResolvedValue({
      data: { user: authenticatedSession.user },
      error: null,
    });
    candidateMocks.listCandidates.mockResolvedValue({
      data: [databaseCandidate],
      error: null,
    });
    candidateMocks.listArchivedCandidates.mockResolvedValue({
      data: [
        {
          ...databaseCandidate,
          id: "c-archived",
          full_name: "アーカイブ候補者",
          archived_at: "2026-08-05T09:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.searchCrm.mockResolvedValue({
      data: [
        {
          entity_type: "candidate",
          entity_id: "c-001",
          primary_text: "佐藤 健太",
          secondary_text: "メディカルデバイス株式会社・医療機器営業",
          status_text: "active_selection",
          updated_at: "2026-08-04T00:00:00Z",
          rank: 0.9,
        },
      ],
      error: null,
    });
    candidateMocks.listAuditLogs.mockResolvedValue({
      data: [
        {
          id: 1,
          actor_id: "user-001",
          action: "update",
          entity_type: "candidate",
          entity_id: "c-001",
          changed_fields: ["candidate_status", "next_action_due_at"],
          transaction_id: 1001,
          occurred_at: "2026-08-06T12:30:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.listCandidateViews.mockResolvedValue({
      data: [databaseCandidateView],
      error: null,
    });
    candidateMocks.recordCandidateView.mockResolvedValue({
      data: databaseCandidateView,
      error: null,
    });
    candidateMocks.getCandidate.mockResolvedValue({
      data: databaseCandidate,
      error: null,
    });
    candidateMocks.updateCandidate.mockResolvedValue({
      data: databaseCandidate,
      error: null,
    });
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "伊東 勇大",
          email: "agent@example.com",
          role: "agent",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.updateOwnProfile.mockResolvedValue({
      data: {
        id: "user-001",
        display_name: "伊東 勇大",
        email: "agent@example.com",
        role: "agent",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-06T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.setProfileRole.mockResolvedValue({
      data: {
        id: "user-002",
        display_name: "閲覧担当",
        email: "viewer@example.com",
        role: "agent",
        created_at: "2026-08-01T00:00:00Z",
        updated_at: "2026-08-06T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.listCandidateAiSummaries.mockResolvedValue({
      data: [databaseAiSummary],
      error: null,
    });
    candidateMocks.reviewAiSummary.mockResolvedValue({
      data: {
        ...databaseAiSummary,
        reviewed_by: "user-001",
        reviewed_at: "2026-08-06T12:00:00Z",
      },
      error: null,
    });
    candidateMocks.generateCandidateSummary.mockResolvedValue({
      data: { summaryId: "ai-summary-002" },
      error: null,
    });
    candidateMocks.extractJobPosting.mockResolvedValue({
      data: {
        company_name: "メディカルデバイス株式会社",
        company_industry: "医療機器メーカー",
        company_website: "https://medical-device.example.jp",
        title: "循環器製品 営業担当",
        division: "循環器事業部",
        occupation: "医療機器営業",
        employment_type: "正社員",
        locations: ["東京都", "大阪府"],
        salary_min: 600,
        salary_max: 900,
        required_conditions: "医療業界での営業経験",
        preferred_conditions: "循環器領域の経験",
        description: "基幹病院への提案営業",
        opened_at: null,
        closed_at: null,
        warnings: [],
        missing_fields: [],
        evidence: [
          { field: "company_name", quote: "メディカルデバイス株式会社" },
          {
            field: "company_website",
            quote: "https://medical-device.example.jp",
          },
          { field: "title", quote: "循環器製品 営業担当" },
          { field: "division", quote: "循環器事業部" },
          { field: "occupation", quote: "医療機器営業" },
          { field: "employment_type", quote: "正社員" },
          { field: "locations", quote: "東京都、大阪府" },
          { field: "salary_min", quote: "年収600万円〜900万円" },
          { field: "salary_max", quote: "年収600万円〜900万円" },
          {
            field: "required_conditions",
            quote: "医療業界での営業経験",
          },
          { field: "preferred_conditions", quote: "循環器領域の経験" },
          { field: "description", quote: "基幹病院への提案営業" },
        ],
      },
      error: null,
    });
    candidateMocks.listApplications.mockResolvedValue({
      data: [databaseApplication],
      error: null,
    });
    candidateMocks.listApplicationStatusHistory.mockResolvedValue({
      data: [databaseApplicationStatusHistory],
      error: null,
    });
    candidateMocks.createApplication.mockResolvedValue({
      data: databaseApplication,
      error: null,
    });
    candidateMocks.updateApplication.mockResolvedValue({
      data: databaseApplication,
      error: null,
    });
    candidateMocks.archiveApplication.mockResolvedValue({
      data: { ...databaseApplication, archived_at: "2026-08-05T00:00:00Z" },
      error: null,
    });
    candidateMocks.listJobs.mockResolvedValue({
      data: [databaseJob],
      error: null,
    });
    candidateMocks.listArchivedJobs.mockResolvedValue({
      data: [
        {
          ...databaseJob,
          id: "j-archived",
          title: "アーカイブ求人",
          archived_at: "2026-08-05T09:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.createJob.mockResolvedValue({
      data: databaseJob,
      error: null,
    });
    candidateMocks.updateJob.mockResolvedValue({
      data: databaseJob,
      error: null,
    });
    candidateMocks.archiveJob.mockResolvedValue({
      data: { ...databaseJob, archived_at: "2026-08-05T00:00:00Z" },
      error: null,
    });
    candidateMocks.restoreJob.mockResolvedValue({
      data: {
        ...databaseJob,
        id: "j-archived",
        title: "アーカイブ求人",
        archived_at: null,
      },
      error: null,
    });
    candidateMocks.listCompanies.mockResolvedValue({
      data: [databaseCompany],
      error: null,
    });
    candidateMocks.listArchivedCompanies.mockResolvedValue({
      data: [
        {
          ...databaseCompany,
          id: "company-archived",
          name: "アーカイブ企業株式会社",
          archived_at: "2026-08-05T09:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.createCompany.mockResolvedValue({
      data: databaseCompany,
      error: null,
    });
    candidateMocks.updateCompany.mockResolvedValue({
      data: databaseCompany,
      error: null,
    });
    candidateMocks.archiveCompany.mockResolvedValue({
      data: { ...databaseCompany, archived_at: "2026-08-05T00:00:00Z" },
      error: null,
    });
    candidateMocks.restoreCompany.mockResolvedValue({
      data: {
        ...databaseCompany,
        id: "company-archived",
        name: "アーカイブ企業株式会社",
        archived_at: null,
      },
      error: null,
    });
    candidateMocks.listCompanyContacts.mockResolvedValue({
      data: [databaseContact],
      error: null,
    });
    candidateMocks.createCompanyContact.mockResolvedValue({
      data: databaseContact,
      error: null,
    });
    candidateMocks.updateCompanyContact.mockResolvedValue({
      data: databaseContact,
      error: null,
    });
    candidateMocks.archiveCompanyContact.mockResolvedValue({
      data: { ...databaseContact, archived_at: "2026-08-05T00:00:00Z" },
      error: null,
    });
    candidateMocks.listActivities.mockResolvedValue({
      data: [databaseActivity],
      error: null,
    });
    candidateMocks.listCandidateActivities.mockResolvedValue({
      data: [databaseActivity],
      error: null,
    });
    candidateMocks.createActivity.mockResolvedValue({
      data: databaseActivity,
      error: null,
    });
    candidateMocks.updateActivity.mockResolvedValue({
      data: databaseActivity,
      error: null,
    });
    candidateMocks.archiveActivity.mockResolvedValue({
      data: { ...databaseActivity, archived_at: "2026-08-06T12:00:00Z" },
      error: null,
    });
    candidateMocks.listTasks.mockResolvedValue({
      data: [databaseTask],
      error: null,
    });
    candidateMocks.createTask.mockResolvedValue({
      data: databaseTask,
      error: null,
    });
    candidateMocks.updateTask.mockResolvedValue({
      data: databaseTask,
      error: null,
    });
    candidateMocks.archiveTask.mockResolvedValue({
      data: { ...databaseTask, archived_at: "2026-08-06T12:00:00Z" },
      error: null,
    });
    candidateMocks.listCandidateFiles.mockResolvedValue({
      data: [databaseFile],
      error: null,
    });
    candidateMocks.listCompanyFiles.mockResolvedValue({
      data: [
        {
          ...databaseFile,
          id: "file-003",
          candidate_id: null,
          company_id: "company-001",
          file_name: "取引基本契約書.pdf",
          storage_path: "user-001/companies/company-001/file-003.pdf",
          category: "other",
        },
      ],
      error: null,
    });
    candidateMocks.listJobFiles.mockResolvedValue({
      data: [
        {
          ...databaseFile,
          id: "file-002",
          candidate_id: null,
          job_id: "j-001",
          file_name: "TAVI営業_求人票.pdf",
          storage_path: "user-001/jobs/j-001/file-002.pdf",
          category: "job_description",
        },
      ],
      error: null,
    });
    candidateMocks.uploadCrmFile.mockResolvedValue({
      data: databaseFile,
      error: null,
    });
    candidateMocks.archiveFile.mockResolvedValue({
      data: { ...databaseFile, archived_at: "2026-08-06T12:00:00Z" },
      error: null,
    });
    candidateMocks.downloadCrmFile.mockResolvedValue({
      data: new Blob(["file"]),
      error: null,
    });
    candidateMocks.listEmailThreads.mockResolvedValue({
      data: [databaseEmailThread],
      error: null,
    });
    candidateMocks.listEmailMessages.mockResolvedValue({
      data: databaseEmailMessages,
      error: null,
    });
    candidateMocks.updateEmailThreadStatus.mockResolvedValue({
      data: { ...databaseEmailThread, status: "handled" },
      error: null,
    });
    candidateMocks.listCandidateExperiences.mockResolvedValue({
      data: [databaseExperience],
      error: null,
    });
    candidateMocks.createCandidateExperience.mockResolvedValue({
      data: databaseExperience,
      error: null,
    });
    candidateMocks.updateCandidateExperience.mockResolvedValue({
      data: databaseExperience,
      error: null,
    });
    candidateMocks.archiveCandidateExperience.mockResolvedValue({
      data: { ...databaseExperience, archived_at: "2026-08-05T00:00:00Z" },
      error: null,
    });
    candidateMocks.listTags.mockResolvedValue({
      data: [
        {
          id: "tag-001",
          name: "医療機器",
          color: null,
          archived_at: null,
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
        {
          id: "tag-002",
          name: "英語",
          color: null,
          archived_at: null,
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.listCandidateTags.mockResolvedValue({
      data: [
        {
          id: "candidate-tag-001",
          candidate_id: "c-001",
          tag_id: "tag-001",
          archived_at: null,
          created_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.listCompanyTags.mockResolvedValue({
      data: [
        {
          id: "company-tag-001",
          company_id: "company-001",
          tag_id: "tag-001",
          archived_at: null,
          created_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.listJobTags.mockResolvedValue({
      data: [
        {
          id: "job-tag-001",
          job_id: "j-001",
          tag_id: "tag-001",
          archived_at: null,
          created_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.createTag.mockResolvedValue({
      data: {
        id: "tag-003",
        name: "管理職候補",
        color: null,
        archived_at: null,
        created_at: "2026-08-05T00:00:00Z",
        updated_at: "2026-08-05T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.attachCandidateTag.mockResolvedValue({
      data: {
        id: "candidate-tag-002",
        candidate_id: "c-001",
        tag_id: "tag-002",
        archived_at: null,
        created_at: "2026-08-05T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.archiveCandidateTag.mockResolvedValue({
      data: {
        id: "candidate-tag-001",
        candidate_id: "c-001",
        tag_id: "tag-001",
        archived_at: "2026-08-05T00:00:00Z",
        created_at: "2026-08-01T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.attachCompanyTag.mockResolvedValue({
      data: {
        id: "company-tag-002",
        company_id: "company-001",
        tag_id: "tag-002",
        archived_at: null,
        created_at: "2026-08-06T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.archiveCompanyTag.mockResolvedValue({
      data: {
        id: "company-tag-001",
        company_id: "company-001",
        tag_id: "tag-001",
        archived_at: "2026-08-06T00:00:00Z",
        created_at: "2026-08-01T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.attachJobTag.mockResolvedValue({
      data: {
        id: "job-tag-002",
        job_id: "j-001",
        tag_id: "tag-002",
        archived_at: null,
        created_at: "2026-08-06T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.archiveJobTag.mockResolvedValue({
      data: {
        id: "job-tag-001",
        job_id: "j-001",
        tag_id: "tag-001",
        archived_at: "2026-08-06T00:00:00Z",
        created_at: "2026-08-01T00:00:00Z",
      },
      error: null,
    });
    candidateMocks.createCandidate.mockResolvedValue({
      data: databaseCandidate,
      error: null,
    });
    candidateMocks.updateCandidate.mockResolvedValue({
      data: databaseCandidate,
      error: null,
    });
    candidateMocks.archiveCandidate.mockResolvedValue({
      data: { ...databaseCandidate, archived_at: "2026-08-05T00:00:00Z" },
      error: null,
    });
    candidateMocks.restoreCandidate.mockResolvedValue({
      data: {
        ...databaseCandidate,
        id: "c-archived",
        full_name: "アーカイブ候補者",
        archived_at: null,
      },
      error: null,
    });
    candidateMocks.inviteUser.mockResolvedValue({ data: true, error: null });
    candidateMocks.completeCandidateNextAction.mockResolvedValue({
      data: {
        ...databaseCandidate,
        next_action: null,
        next_action_due_at: null,
        waiting_on: "none",
      },
      error: null,
    });
  });

  it("ホームに今日の対応とログインユーザーを表示する", async () => {
    renderRoute("/");
    expect(
      await screen.findByRole("heading", { name: "今日のホーム" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "今日の対応" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("候補者へ面談後フォロー").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "最近見た候補者" }),
    ).toBeInTheDocument();
    expect(screen.getByText("agent@example.com")).toBeInTheDocument();
  });

  it("存在しないURLで404画面を表示する", async () => {
    renderRoute("/unknown-route");

    expect(
      await screen.findByRole("heading", { name: "ページが見つかりません" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "ホームへ戻る" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("全体検索から候補者詳細へ移動できる", async () => {
    const user = userEvent.setup();
    renderRoute("/");

    const searchInput = await screen.findByRole("combobox", {
      name: "全体検索",
    });
    await user.type(searchInput, "佐藤");

    const result = await screen.findByRole("option", {
      name: /佐藤 健太.*候補者/,
    });
    await user.click(result);

    expect(candidateMocks.searchCrm).toHaveBeenCalledWith("佐藤");
    expect(
      await screen.findByRole("heading", { name: "佐藤 健太" }),
    ).toBeInTheDocument();
  });

  it("ホームからタスクを完了できる", async () => {
    const user = userEvent.setup();
    renderRoute("/");

    await user.click(
      await screen.findByRole("button", {
        name: "候補者へ面談後フォローを完了",
      }),
    );

    await waitFor(() => expect(candidateMocks.updateTask).toHaveBeenCalled());
    const [taskId, values] = candidateMocks.updateTask.mock
      .calls[0] as unknown as [string, { completed_at: string }];
    expect(taskId).toBe("task-001");
    expect(Number.isNaN(Date.parse(values.completed_at))).toBe(false);
  });

  it("候補者一覧から候補者詳細へ遷移できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates");
    await user.type(
      await screen.findByRole("textbox", { name: "候補者検索" }),
      "佐藤",
    );
    await user.click(screen.getByRole("link", { name: "佐藤 健太" }));
    expect(
      await screen.findByRole("heading", { name: "佐藤 健太" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(candidateMocks.recordCandidateView).toHaveBeenCalledWith("c-001"),
    );
  });

  it("招待利用者が初回パスワードを設定できる", async () => {
    const user = userEvent.setup();
    renderRoute("/set-password");

    await user.type(
      await screen.findByLabelText("新しいパスワード"),
      "secure-password-123",
    );
    await user.type(
      screen.getByLabelText("パスワード（確認）"),
      "secure-password-123",
    );
    await user.click(
      screen.getByRole("button", { name: "パスワードを設定して開始" }),
    );

    await waitFor(() =>
      expect(authMocks.updateUser).toHaveBeenCalledWith({
        password: "secure-password-123",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "今日のホーム" }),
    ).toBeVisible();
  });

  it("再設定リンクから新しいパスワードを保存できる", async () => {
    const user = userEvent.setup();
    renderRoute("/set-password?mode=recovery");

    expect(
      await screen.findByText("Candidate CRMのパスワード再設定"),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("新しいパスワード"),
      "recovered-password-123",
    );
    await user.type(
      screen.getByLabelText("パスワード（確認）"),
      "recovered-password-123",
    );
    await user.click(
      screen.getByRole("button", { name: "パスワードを変更して開始" }),
    );

    await waitFor(() =>
      expect(authMocks.updateUser).toHaveBeenCalledWith({
        password: "recovered-password-123",
      }),
    );
  });

  it("候補者詳細の初期タブがタイムラインである", async () => {
    renderRoute("/candidates/c-001");
    expect(
      await screen.findByRole("tab", { name: "タイムライン" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "候補者タイムライン" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "メール作成" }),
    ).not.toBeInTheDocument();
  });

  it("候補者サマリーから求人提案フォームを開ける", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");

    await user.click(await screen.findByRole("button", { name: "求人提案" }));

    expect(screen.getByRole("tab", { name: "求人・選考" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      await screen.findByRole("heading", { name: "求人を提案" }),
    ).toBeVisible();
    expect(screen.getByLabelText("求人 *")).toBeVisible();
  });

  it("候補者の次回対応を確認後に完了できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");

    await screen.findByRole("heading", { name: "佐藤 健太" });
    await user.click(screen.getByRole("button", { name: "完了" }));

    expect(
      screen.getByText(
        "完了すると内容をタイムラインへ記録し、次回対応を未設定にします。",
      ),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "完了を確定" }));

    await waitFor(() =>
      expect(candidateMocks.completeCandidateNextAction).toHaveBeenCalledWith(
        "c-001",
      ),
    );
    expect(await screen.findByText("次回対応は未設定です")).toBeVisible();
  });

  it("候補者詳細の各タブを切り替えられる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await screen.findByRole("tab", { name: "タイムライン" });
    const expectations = [
      ["概要", "キャリア情報"],
      ["職務経歴", "メディカルデバイス株式会社"],
      ["求人・選考", "候補者単位の進行状況"],
      ["タスク", "未完了"],
      ["ファイル", "佐藤健太_履歴書.pdf"],
      ["AI", "候補者サマリー"],
    ] as const;
    for (const [tab, content] of expectations) {
      await user.click(screen.getByRole("tab", { name: tab }));
      expect(await screen.findByText(content)).toBeInTheDocument();
    }
  });

  it("候補者の選考ステータス履歴を表示する", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");

    await user.click(await screen.findByRole("tab", { name: "求人・選考" }));

    expect(
      await screen.findByRole("heading", { name: "選考ステータス履歴" }),
    ).toBeInTheDocument();
    const historyItem = screen.getByRole("listitem", {
      name: "求人提案を初期状態として記録",
    });
    expect(historyItem).toBeInTheDocument();
    expect(within(historyItem).getByText("移行時点の状態")).toBeInTheDocument();
    expect(within(historyItem).getByText("伊東 勇大")).toBeInTheDocument();
  });

  it("Supabase由来のAIサマリーを表示し確認済みにできる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("tab", { name: "AI" }));

    expect(
      await screen.findByText(
        "医療機器営業として循環器領域の経験を持つ候補者です。",
      ),
    ).toBeVisible();
    expect(screen.getByText(/モデル：server-model-001/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "内容を確認済みにする" }),
    );
    await waitFor(() =>
      expect(candidateMocks.reviewAiSummary).toHaveBeenCalledWith(
        "ai-summary-001",
        "user-001",
      ),
    );
  });

  it("候補者AIタブからサーバー側の再生成を要求できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("tab", { name: "AI" }));

    await user.click(await screen.findByRole("button", { name: "再生成" }));
    expect(screen.getByRole("alertdialog")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "料金を確認して生成する" }),
    );

    await waitFor(() =>
      expect(candidateMocks.generateCandidateSummary).toHaveBeenCalledWith(
        "c-001",
      ),
    );
  });

  it("候補者へファイルをアップロードできる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("tab", { name: "ファイル" }));
    const file = new File(["resume"], "新しい履歴書.pdf", {
      type: "application/pdf",
    });
    await user.upload(screen.getByLabelText("ファイル"), file);
    await user.click(screen.getByRole("button", { name: "アップロード" }));

    await waitFor(() =>
      expect(candidateMocks.uploadCrmFile).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: "user-001",
          candidateId: "c-001",
          category: "resume",
          file,
        }),
      ),
    );
  });

  it("候補者の職歴を追加できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("tab", { name: "職務経歴" }));
    await user.click(screen.getByRole("button", { name: "職歴追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "勤務先 *" }),
      "製薬株式会社",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(candidateMocks.createCandidateExperience).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate_id: "c-001",
          company_name: "製薬株式会社",
        }),
      ),
    );
  });

  it("候補者へ求人を提案できる", async () => {
    const user = userEvent.setup();
    candidateMocks.listApplications.mockResolvedValue({
      data: [],
      error: null,
    });
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("tab", { name: "求人・選考" }));
    const proposalButton = screen.getByRole("button", { name: "求人を提案" });
    await waitFor(() => expect(proposalButton).toBeEnabled());
    await user.click(proposalButton);
    await screen.findByRole("option", {
      name: "メディカルデバイス株式会社 / TAVI製品 営業担当",
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "求人 *" }),
      "j-001",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(candidateMocks.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate_id: "c-001",
          job_id: "j-001",
          owner_id: "user-001",
          application_status: "proposed",
        }),
      ),
    );
  });

  it("候補者タイムラインへ活動を追加できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("button", { name: "活動追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "タイトル *" }),
      "電話で希望条件を確認",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(candidateMocks.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate_id: "c-001",
          owner_id: "user-001",
          title: "電話で希望条件を確認",
          ai_generated: false,
        }),
      ),
    );
  });

  it("候補者へタスクを追加できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("tab", { name: "タスク" }));
    await user.click(screen.getByRole("button", { name: "タスク追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "タスク内容 *" }),
      "候補者へ書類確認",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(candidateMocks.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate_id: "c-001",
          owner_id: "user-001",
          title: "候補者へ書類確認",
        }),
      ),
    );
  });

  it("候補者へ既存タグを追加し、タグを外せる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await user.click(await screen.findByRole("tab", { name: "概要" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "既存タグ" }),
      "tag-002",
    );
    await user.click(screen.getByRole("button", { name: "追加" }));
    await waitFor(() =>
      expect(candidateMocks.attachCandidateTag).toHaveBeenCalledWith({
        candidate_id: "c-001",
        tag_id: "tag-002",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "医療機器タグを外す" }),
    );
    await waitFor(() =>
      expect(candidateMocks.archiveCandidateTag).toHaveBeenCalledWith(
        "candidate-tag-001",
      ),
    );
  });

  it("候補者を新規登録し、ログインユーザーをownerに設定する", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/new");
    await user.type(
      await screen.findByRole("textbox", { name: "氏名（必須）" }),
      "新規 候補者",
    );
    await user.click(screen.getByRole("button", { name: "候補者を登録" }));

    await waitFor(() =>
      expect(candidateMocks.createCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "新規 候補者",
          owner_id: "user-001",
          candidate_status: "new",
        }),
      ),
    );
  });

  it("候補者フォームの未保存変更を離脱前に確認する", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/new");

    await user.type(
      await screen.findByRole("textbox", { name: "氏名（必須）" }),
      "入力途中候補者",
    );
    await user.click(screen.getByRole("link", { name: "候補者一覧へ戻る" }));

    expect(
      screen.getByRole("dialog", { name: "入力途中の内容があります" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "編集を続ける" }));
    expect(screen.getByRole("textbox", { name: "氏名（必須）" })).toHaveValue(
      "入力途中候補者",
    );
  });

  it("候補者の重複候補を確認してから登録を続行できる", async () => {
    candidateMocks.createCandidate.mockClear();
    const user = userEvent.setup();
    renderRoute("/candidates/new");

    await user.type(await screen.findByLabelText("氏名（必須）"), "佐藤 健太");
    await user.click(screen.getByRole("button", { name: "候補者を登録" }));

    expect(
      await screen.findByRole("heading", {
        name: "既存候補者と一致する情報があります",
      }),
    ).toBeVisible();
    expect(screen.getByText(/一致：氏名/)).toBeVisible();
    expect(candidateMocks.createCandidate).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "重複でないことを確認して登録",
      }),
    );
    await waitFor(() =>
      expect(candidateMocks.createCandidate).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "佐藤 健太",
          owner_id: "user-001",
        }),
      ),
    );
  });

  it("候補者を編集できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001/edit");
    const nameInput = await screen.findByRole("textbox", {
      name: "氏名（必須）",
    });
    await user.clear(nameInput);
    await user.type(nameInput, "佐藤 健太郎");
    await user.click(screen.getByRole("button", { name: "変更を保存" }));

    await waitFor(() =>
      expect(candidateMocks.updateCandidate).toHaveBeenCalledWith(
        "c-001",
        expect.objectContaining({ full_name: "佐藤 健太郎" }),
      ),
    );
  });

  it("候補者を物理削除せずアーカイブできる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001/edit");
    await user.click(await screen.findByRole("button", { name: "アーカイブ" }));
    await user.click(screen.getByRole("button", { name: "実行" }));

    await waitFor(() =>
      expect(candidateMocks.archiveCandidate).toHaveBeenCalledWith("c-001"),
    );
  });

  it("候補者取得エラーを日本語表示して再試行できる", async () => {
    const user = userEvent.setup();
    candidateMocks.listCandidates.mockResolvedValueOnce({
      data: null,
      error: { message: "候補者データを取得できませんでした。" },
    });
    renderRoute("/candidates");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "候補者データを取得できませんでした。",
    );
    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(await screen.findByText("佐藤 健太")).toBeInTheDocument();
  });

  it("求人一覧から求人詳細へ遷移できる", async () => {
    const user = userEvent.setup();
    renderRoute("/jobs");
    await user.click(
      await screen.findByRole("link", { name: "TAVI製品 営業担当" }),
    );
    expect(
      await screen.findByRole("heading", { name: "TAVI製品 営業担当" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "候補者" })).toBeInTheDocument();
  });

  it("求人詳細で非公開求人票を表示する", async () => {
    const user = userEvent.setup();
    renderRoute("/jobs/j-001");
    await user.click(
      await screen.findByRole("tab", { name: "ファイル・求人票" }),
    );
    expect(await screen.findByText("TAVI営業_求人票.pdf")).toBeInTheDocument();
  });

  it("求人詳細から候補者を提案できる", async () => {
    const user = userEvent.setup();
    candidateMocks.listApplications.mockResolvedValueOnce({
      data: [],
      error: null,
    });
    renderRoute("/jobs/j-001");

    await user.click(
      await screen.findByRole("button", { name: "候補者を提案" }),
    );
    expect(screen.getByRole("tab", { name: "候補者" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.selectOptions(screen.getByLabelText("候補者 *"), "c-001");
    await user.click(screen.getByRole("button", { name: "提案を保存" }));

    await waitFor(() =>
      expect(candidateMocks.createApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          candidate_id: "c-001",
          job_id: "j-001",
          application_status: "proposed",
          owner_id: "user-001",
        }),
      ),
    );
  });

  it("求人詳細に関連する活動履歴を表示する", async () => {
    const user = userEvent.setup();
    renderRoute("/jobs/j-001");
    await user.click(await screen.findByRole("tab", { name: "活動履歴" }));

    const heading = await screen.findByRole("heading", {
      name: "求人の活動履歴",
    });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    const activityHistory = within(section as HTMLElement);
    expect(activityHistory.getByText("初回キャリア面談（Zoom）")).toBeVisible();
    expect(activityHistory.getByText("希望条件を確認")).toBeVisible();
    expect(
      activityHistory.getByRole("link", { name: "佐藤 健太" }),
    ).toHaveAttribute("href", "/candidates/c-001");
    expect(activityHistory.getByText(/担当：伊東 勇大/)).toBeVisible();
  });

  it("求人へ正規化タグを追加できる", async () => {
    const user = userEvent.setup();
    renderRoute("/jobs/j-001");

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "求人の既存タグ" }),
      "tag-002",
    );
    await user.click(
      screen.getByRole("button", { name: "求人へ既存タグを追加" }),
    );

    await waitFor(() =>
      expect(candidateMocks.attachJobTag).toHaveBeenCalledWith({
        job_id: "j-001",
        tag_id: "tag-002",
      }),
    );
  });

  it("企業を新規登録できる", async () => {
    candidateMocks.createCompany.mockClear();
    const user = userEvent.setup();
    renderRoute("/companies/new");
    await user.type(
      await screen.findByRole("textbox", { name: "企業名 *" }),
      "新規医療株式会社",
    );
    await user.click(screen.getByRole("button", { name: "企業を登録" }));
    await waitFor(() =>
      expect(candidateMocks.createCompany).toHaveBeenCalledWith(
        expect.objectContaining({ name: "新規医療株式会社" }),
      ),
    );
  });

  it("既存企業と同名の場合は確認してから登録する", async () => {
    candidateMocks.createCompany.mockClear();
    const user = userEvent.setup();
    renderRoute("/companies/new");
    await user.type(
      await screen.findByRole("textbox", { name: "企業名 *" }),
      "メディカル デバイス株式会社",
    );
    await user.click(screen.getByRole("button", { name: "企業を登録" }));

    expect(
      await screen.findByRole("heading", {
        name: "既存企業と一致する情報があります",
      }),
    ).toBeVisible();
    expect(candidateMocks.createCompany).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "重複でないことを確認して登録" }),
    );
    await waitFor(() =>
      expect(candidateMocks.createCompany).toHaveBeenCalledWith(
        expect.objectContaining({ name: "メディカル デバイス株式会社" }),
      ),
    );
  });

  it("企業一覧から企業詳細へ遷移し、関連活動を表示する", async () => {
    const user = userEvent.setup();
    renderRoute("/companies");
    await user.click(
      await screen.findByRole("link", {
        name: "メディカルデバイス株式会社",
      }),
    );

    expect(
      await screen.findByRole("heading", {
        name: "メディカルデバイス株式会社",
      }),
    ).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "活動履歴" }));
    const heading = await screen.findByRole("heading", {
      name: "企業の活動履歴",
    });
    const section = heading.closest("section");
    expect(section).not.toBeNull();
    const activityHistory = within(section as HTMLElement);
    expect(activityHistory.getByText("初回キャリア面談（Zoom）")).toBeVisible();
    expect(
      activityHistory.getByRole("link", { name: "TAVI製品 営業担当" }),
    ).toHaveAttribute("href", "/jobs/j-001");

    await user.click(screen.getByRole("tab", { name: "ファイル" }));
    expect(await screen.findByText("取引基本契約書.pdf")).toBeVisible();
    expect(candidateMocks.listCompanyFiles).toHaveBeenCalledWith("company-001");
  });

  it("アーカイブ済み企業を通常一覧へ復元できる", async () => {
    candidateMocks.restoreCompany.mockClear();
    candidateMocks.listArchivedCompanies
      .mockResolvedValueOnce({
        data: [
          {
            ...databaseCompany,
            id: "company-archived",
            name: "アーカイブ企業株式会社",
            archived_at: "2026-08-05T09:00:00Z",
          },
        ],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });
    const user = userEvent.setup();
    renderRoute("/companies");

    await user.click(
      await screen.findByRole("button", { name: "アーカイブ済み" }),
    );
    expect(await screen.findByText("アーカイブ企業株式会社")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "アーカイブ企業株式会社を復元" }),
    );

    await waitFor(() =>
      expect(candidateMocks.restoreCompany).toHaveBeenCalledWith(
        "company-archived",
      ),
    );
    expect(
      await screen.findByText(
        "アーカイブ企業株式会社を企業一覧へ復元しました。",
      ),
    ).toBeVisible();
  });

  it("企業へ採用担当者を追加できる", async () => {
    const user = userEvent.setup();
    renderRoute("/companies/company-001/edit");
    await user.click(await screen.findByRole("button", { name: "担当者追加" }));
    await user.type(
      screen.getByRole("textbox", { name: "氏名 *" }),
      "田中 採用",
    );
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() =>
      expect(candidateMocks.createCompanyContact).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: "company-001",
          full_name: "田中 採用",
        }),
      ),
    );
  });

  it("企業へ正規化タグを追加し解除できる", async () => {
    const user = userEvent.setup();
    renderRoute("/companies/company-001/edit");

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "企業の既存タグ" }),
      "tag-002",
    );
    await user.click(
      screen.getByRole("button", { name: "企業へ既存タグを追加" }),
    );
    await waitFor(() =>
      expect(candidateMocks.attachCompanyTag).toHaveBeenCalledWith({
        company_id: "company-001",
        tag_id: "tag-002",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "企業から医療機器タグを外す" }),
    );
    await waitFor(() =>
      expect(candidateMocks.archiveCompanyTag).toHaveBeenCalledWith(
        "company-tag-001",
      ),
    );
  });

  it("求人を新規登録し、ログインユーザーをownerに設定する", async () => {
    candidateMocks.createJob.mockClear();
    const user = userEvent.setup();
    renderRoute("/jobs/new");
    await screen.findByRole("option", {
      name: "メディカルデバイス株式会社",
    });
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "企業 *" }),
      "company-001",
    );
    await user.type(
      screen.getByRole("textbox", { name: "求人名 *" }),
      "新規営業求人",
    );
    await user.click(screen.getByRole("button", { name: "求人を登録" }));
    await waitFor(() =>
      expect(candidateMocks.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: "company-001",
          title: "新規営業求人",
          owner_id: "user-001",
        }),
      ),
    );
  });

  it("求人票テキストをAIで読み取り、確認後に既存フォームへ反映する", async () => {
    candidateMocks.extractJobPosting.mockClear();
    const user = userEvent.setup();
    renderRoute("/jobs/new");
    await screen.findByRole("option", {
      name: "メディカルデバイス株式会社",
    });

    await user.type(
      screen.getByRole("textbox", { name: "求人票テキスト" }),
      "メディカルデバイス株式会社の循環器製品営業。勤務地は東京都と大阪府です。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(await screen.findByText("読み取り結果")).toBeVisible();
    expect(
      screen.getByText(
        "企業照合：登録済みの「メディカルデバイス株式会社」を企業欄へ反映できます（企業名一致）。",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "必須項目：企業と求人名を確認できます。反映後に内容を確認して登録してください。",
      ),
    ).toBeVisible();
    expect(screen.getByText(/貼り付けテキスト/)).toBeVisible();
    expect(screen.getByText(/入力欄への変更内容（/)).toBeVisible();
    expect(
      screen.getByText(
        "空欄への追加だけを初期選択しています。既存値の変更・クリアは、内容を確認して選択してください。",
      ),
    ).toBeVisible();
    expect(candidateMocks.extractJobPosting).toHaveBeenCalledWith({
      type: "text",
      text: "メディカルデバイス株式会社の循環器製品営業。勤務地は東京都と大阪府です。",
    });

    await user.click(screen.getByRole("checkbox", { name: "職種を反映" }));
    await user.click(
      screen.getByRole("button", { name: /選択した内容を反映/ }),
    );
    expect(screen.getByRole("textbox", { name: "求人名 *" })).toHaveValue(
      "循環器製品 営業担当",
    );
    expect(screen.getByRole("combobox", { name: "企業 *" })).toHaveValue(
      "company-001",
    );
    expect(screen.getByRole("combobox", { name: "企業 *" })).toHaveFocus();
    expect(
      screen.getByRole("textbox", { name: "勤務地（読点区切り）" }),
    ).toHaveValue("東京都、大阪府");
    expect(screen.getByRole("textbox", { name: "職種" })).toHaveValue("");
    expect(
      screen.getByText(
        /AI抽出結果から\d+項目を反映しました。\d+項目は反映せず保留しています。求人の登録はまだ完了していません。/,
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    expect(await screen.findByText("読み取り結果")).toBeVisible();
    expect(
      screen.getByText(
        "前回の読み取り結果を再利用しました。追加のAI実行は発生していません。",
      ),
    ).toBeVisible();
    expect(candidateMocks.extractJobPosting).toHaveBeenCalledTimes(1);
  });

  it("AI反映後に不足している必須項目へフォーカスする", async () => {
    candidateMocks.createCompany.mockResolvedValueOnce({
      data: {
        ...databaseCompany,
        id: "company-imported",
        name: "未登録メディカル株式会社（確認済み）",
      },
      error: null,
    });
    candidateMocks.extractJobPosting.mockResolvedValueOnce({
      data: {
        company_name: "未登録メディカル株式会社",
        company_industry: "医療機器",
        company_website: "https://unregistered-medical.example.jp",
        title: "医療機器営業",
        division: null,
        occupation: "医療機器営業",
        employment_type: "正社員",
        locations: ["東京都"],
        salary_min: 600,
        salary_max: 800,
        required_conditions: null,
        preferred_conditions: null,
        description: null,
        opened_at: null,
        closed_at: null,
        warnings: [],
        missing_fields: [],
        evidence: [
          { field: "company_name", quote: "未登録メディカル株式会社" },
          {
            field: "company_website",
            quote: "https://unregistered-medical.example.jp",
          },
          { field: "title", quote: "医療機器営業" },
          { field: "occupation", quote: "医療機器営業" },
          { field: "employment_type", quote: "正社員" },
          { field: "locations", quote: "東京都" },
          { field: "salary_min", quote: "年収600万円〜800万円" },
          { field: "salary_max", quote: "年収600万円〜800万円" },
        ],
      },
      error: null,
    });
    const user = userEvent.setup();
    renderRoute("/jobs/new");
    await screen.findByRole("option", {
      name: "メディカルデバイス株式会社",
    });

    await user.type(
      screen.getByRole("textbox", { name: "求人票テキスト" }),
      "未登録メディカル株式会社の医療機器営業。勤務地は東京都です。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    await user.click(
      await screen.findByRole("button", { name: /選択した内容を反映/ }),
    );

    expect(screen.getByRole("textbox", { name: "求人名 *" })).toHaveValue(
      "医療機器営業",
    );
    expect(screen.getByRole("combobox", { name: "企業 *" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "企業 *" })).toHaveFocus();
    const importedCompanyName = screen.getByRole("textbox", {
      name: "登録する企業名",
    });
    expect(importedCompanyName).toHaveValue("未登録メディカル株式会社");
    const importedCompanyIndustry = screen.getByRole("textbox", {
      name: "業種（任意）",
    });
    expect(importedCompanyIndustry).toHaveValue("医療機器");
    expect(
      screen.getByRole("textbox", { name: "Webサイト（任意）" }),
    ).toHaveValue("https://unregistered-medical.example.jp");
    await user.clear(importedCompanyName);
    await user.type(
      importedCompanyName,
      "未登録メディカル株式会社（確認済み）",
    );
    await user.clear(importedCompanyIndustry);
    await user.type(importedCompanyIndustry, "医療機器メーカー");

    await user.click(
      screen.getByRole("button", { name: "この企業を登録して選択" }),
    );

    await waitFor(() =>
      expect(candidateMocks.createCompany).toHaveBeenCalledWith({
        name: "未登録メディカル株式会社（確認済み）",
        industry: "医療機器メーカー",
        website: "https://unregistered-medical.example.jp",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "企業 *" })).toHaveValue(
        "company-imported",
      ),
    );
    expect(
      screen.getByText(
        "企業「未登録メディカル株式会社（確認済み）」を登録し、求人の企業欄へ選択しました。企業の詳細情報は後から企業画面で追加できます。",
      ),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "求人名 *" })).toHaveFocus();
  });

  it("企業名とWebサイトの照合が競合した場合に既存企業を明示選択できる", async () => {
    const nameMatchedCompany = {
      ...databaseCompany,
      id: "company-name-match",
      name: "候補メディカル株式会社",
      website: "https://name-match.example.jp",
    };
    const websiteMatchedCompany = {
      ...databaseCompany,
      id: "company-website-match",
      name: "公式サイト登録企業株式会社",
      website: "https://official-company.example.jp",
    };
    candidateMocks.listCompanies.mockResolvedValueOnce({
      data: [nameMatchedCompany, websiteMatchedCompany],
      error: null,
    });
    candidateMocks.extractJobPosting.mockResolvedValueOnce({
      data: {
        company_name: "候補メディカル株式会社",
        company_industry: "医療機器",
        company_website: "https://official-company.example.jp",
        title: "医療機器営業",
        division: null,
        occupation: "医療機器営業",
        employment_type: "正社員",
        locations: ["東京都"],
        salary_min: 600,
        salary_max: 800,
        required_conditions: null,
        preferred_conditions: null,
        description: null,
        opened_at: null,
        closed_at: null,
        warnings: [],
        missing_fields: [],
        evidence: [
          { field: "company_name", quote: "候補メディカル株式会社" },
          {
            field: "company_website",
            quote: "https://official-company.example.jp",
          },
          { field: "title", quote: "医療機器営業" },
          { field: "occupation", quote: "医療機器営業" },
          { field: "employment_type", quote: "正社員" },
          { field: "locations", quote: "東京都" },
          { field: "salary_min", quote: "年収600万円〜800万円" },
          { field: "salary_max", quote: "年収600万円〜800万円" },
        ],
      },
      error: null,
    });
    candidateMocks.createCompany.mockClear();
    const user = userEvent.setup();
    renderRoute("/jobs/new");
    await screen.findByRole("option", { name: "候補メディカル株式会社" });

    await user.type(
      screen.getByRole("textbox", { name: "求人票テキスト" }),
      "候補メディカル株式会社の医療機器営業求人。勤務地は東京都です。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    expect(
      await screen.findByText(
        "企業照合：企業名とWebサイトが別々の登録済み企業に一致しました。自動反映せず、既存企業を確認してください。",
      ),
    ).toBeVisible();
    expect(screen.getByText("企業名一致")).toBeVisible();
    expect(screen.getByText("Webサイト一致")).toBeVisible();
    const applyButton = screen.getByRole("button", {
      name: /選択した内容を反映/,
    });
    expect(applyButton).toBeDisabled();

    await user.click(
      screen.getByRole("button", {
        name: "取り込み企業候補「候補メディカル株式会社」を選択",
      }),
    );
    expect(applyButton).toBeEnabled();
    await user.click(applyButton);

    expect(screen.getByRole("combobox", { name: "企業 *" })).toHaveValue(
      "company-name-match",
    );
    expect(candidateMocks.createCompany).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "求人名 *" })).toHaveFocus();
  });

  it("公開求人URLをAI取り込みへ送信できる", async () => {
    const user = userEvent.setup();
    renderRoute("/jobs/new");
    await screen.findByRole("option", {
      name: "メディカルデバイス株式会社",
    });

    await user.click(screen.getByRole("button", { name: "公開URLを入力" }));
    await user.type(
      screen.getByRole("textbox", { name: /公開求人ページURL/ }),
      "https://careers.example.co.jp/jobs/123",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(await screen.findByText("読み取り結果")).toBeVisible();
    expect(candidateMocks.extractJobPosting).toHaveBeenCalledWith({
      type: "url",
      url: "https://careers.example.co.jp/jobs/123",
    });
  });

  it("同じ企業に同名求人がある場合は確認してから登録する", async () => {
    candidateMocks.createJob.mockClear();
    const user = userEvent.setup();
    renderRoute("/jobs/new");
    await screen.findByRole("option", {
      name: "メディカルデバイス株式会社",
    });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "企業 *" }),
      "company-001",
    );
    await user.type(
      screen.getByRole("textbox", { name: "求人名 *" }),
      "TAVI製品営業担当",
    );
    await user.click(screen.getByRole("button", { name: "求人を登録" }));

    expect(
      await screen.findByRole("heading", {
        name: "同じ企業に一致する求人があります",
      }),
    ).toBeVisible();
    expect(candidateMocks.createJob).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", {
        name: "別求人であることを確認して登録",
      }),
    );
    await waitFor(() =>
      expect(candidateMocks.createJob).toHaveBeenCalledWith(
        expect.objectContaining({
          company_id: "company-001",
          title: "TAVI製品営業担当",
          owner_id: "user-001",
        }),
      ),
    );
  });

  it("アーカイブ済み求人を通常一覧へ復元できる", async () => {
    candidateMocks.restoreJob.mockClear();
    candidateMocks.listArchivedJobs
      .mockResolvedValueOnce({
        data: [
          {
            ...databaseJob,
            id: "j-archived",
            title: "アーカイブ求人",
            archived_at: "2026-08-05T09:00:00Z",
          },
        ],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });
    const user = userEvent.setup();
    renderRoute("/jobs");

    await user.click(
      await screen.findByRole("button", { name: "アーカイブ済み" }),
    );
    expect(await screen.findByText("アーカイブ求人")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "アーカイブ求人を復元" }),
    );

    await waitFor(() =>
      expect(candidateMocks.restoreJob).toHaveBeenCalledWith("j-archived"),
    );
    expect(
      await screen.findByText("アーカイブ求人を求人一覧へ復元しました。"),
    ).toBeVisible();
  });

  it("親企業がアーカイブ済みの求人は復元できない", async () => {
    candidateMocks.listArchivedJobs.mockResolvedValueOnce({
      data: [
        {
          ...databaseJob,
          id: "j-blocked",
          company_id: "company-archived",
          title: "企業復元待ち求人",
          archived_at: "2026-08-05T09:00:00Z",
        },
      ],
      error: null,
    });
    const user = userEvent.setup();
    renderRoute("/jobs");

    await user.click(
      await screen.findByRole("button", { name: "アーカイブ済み" }),
    );
    expect(await screen.findByText("企業復元待ち求人")).toBeVisible();
    expect(screen.getByText("先に企業を復元")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "企業復元待ち求人を復元" }),
    ).not.toBeInTheDocument();
  });

  it("Inbox画面を表示する", async () => {
    renderRoute("/inbox");
    expect(
      await screen.findByRole("heading", {
        name: "Inbox",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "メール一覧" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", {
        name: "一次面接後の追加確認について",
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        "担当製品と営業エリアについて確認できますでしょうか。",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "AI下書き" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "返信を作成" }),
    ).not.toBeInTheDocument();
  });

  it("Inboxのスレッドを対応済みにできる", async () => {
    const user = userEvent.setup();
    renderRoute("/inbox");
    await user.click(
      await screen.findByRole("button", { name: "対応済みにする" }),
    );
    await waitFor(() =>
      expect(candidateMocks.updateEmailThreadStatus).toHaveBeenCalledWith(
        "email-thread-001",
        "handled",
      ),
    );
  });

  it("今日の予定画面を表示する", async () => {
    renderRoute("/today");
    expect(
      await screen.findByRole("heading", {
        name: "今日の予定",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("活動予定とタスク期限を統合して表示しています。"),
    ).toBeInTheDocument();
  });

  it("候補者画面でパイプライン表示へ切り替えられる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates");
    await user.click(
      await screen.findByRole("button", { name: "パイプライン" }),
    );
    expect(
      screen.getByRole("region", { name: "面談前列" }),
    ).toBeInTheDocument();
  });

  it("アーカイブ済み候補者を通常一覧へ復元できる", async () => {
    candidateMocks.restoreCandidate.mockClear();
    candidateMocks.listArchivedCandidates
      .mockResolvedValueOnce({
        data: [
          {
            ...databaseCandidate,
            id: "c-archived",
            full_name: "アーカイブ候補者",
            archived_at: "2026-08-05T09:00:00Z",
          },
        ],
        error: null,
      })
      .mockResolvedValue({ data: [], error: null });
    const user = userEvent.setup();
    renderRoute("/candidates");

    await user.click(
      await screen.findByRole("button", { name: "アーカイブ済み" }),
    );
    expect(await screen.findByText("アーカイブ候補者")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "アーカイブ候補者を復元" }),
    );

    await waitFor(() =>
      expect(candidateMocks.restoreCandidate).toHaveBeenCalledWith(
        "c-archived",
      ),
    );
    expect(
      await screen.findByText("アーカイブ候補者を候補者一覧へ復元しました。"),
    ).toBeVisible();
  });

  it("候補者カードをグループ化パイプライン内で移動できる", async () => {
    const movedCandidate = {
      ...databaseCandidate,
      candidate_status: "interview_scheduling",
    } as const;
    candidateMocks.updateCandidate.mockResolvedValueOnce({
      data: movedCandidate,
      error: null,
    });
    candidateMocks.listCandidates
      .mockResolvedValueOnce({ data: [databaseCandidate], error: null })
      .mockResolvedValue({ data: [movedCandidate], error: null });
    renderRoute("/pipeline");
    const storedData = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData: (type: string, value: string) => storedData.set(type, value),
      getData: (type: string) => storedData.get(type) ?? "",
    };
    const candidateCard = await screen.findByRole("article", {
      name: "佐藤 健太の候補者カード",
    });
    await waitFor(() =>
      expect(candidateCard).toHaveAttribute("draggable", "true"),
    );
    fireEvent.dragStart(candidateCard, { dataTransfer });
    const destination = screen.getByRole("region", { name: "面談前列" });
    fireEvent.drop(destination, { dataTransfer });
    await waitFor(() =>
      expect(candidateMocks.updateCandidate).toHaveBeenCalledWith("c-001", {
        candidate_status: "interview_scheduling",
      }),
    );
    expect(
      within(destination).getByRole("article", {
        name: "佐藤 健太の候補者カード",
      }),
    ).toBeInTheDocument();
  });

  it("パイプライン保存失敗時は候補者カードを元の列へ戻す", async () => {
    candidateMocks.updateCandidate.mockResolvedValueOnce({
      data: null,
      error: { message: "候補者情報を更新できませんでした。" },
    });
    renderRoute("/pipeline");
    const storedData = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData: (type: string, value: string) => storedData.set(type, value),
      getData: (type: string) => storedData.get(type) ?? "",
    };
    const candidateCard = await screen.findByRole("article", {
      name: "佐藤 健太の候補者カード",
    });
    fireEvent.dragStart(candidateCard, { dataTransfer });
    fireEvent.drop(screen.getByRole("region", { name: "面談前列" }), {
      dataTransfer,
    });

    expect(
      await screen.findByText(
        "佐藤 健太のステータスを保存できませんでした。元の列へ戻しました。",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "選考中列" })).getByRole(
        "article",
        { name: "佐藤 健太の候補者カード" },
      ),
    ).toBeInTheDocument();
  });

  it("ドラッグ操作を使わずにパイプラインステージを変更できる", async () => {
    const user = userEvent.setup();
    const movedCandidate = {
      ...databaseCandidate,
      candidate_status: "offered",
    } as const;
    candidateMocks.updateCandidate.mockResolvedValueOnce({
      data: movedCandidate,
      error: null,
    });
    candidateMocks.listCandidates
      .mockResolvedValueOnce({ data: [databaseCandidate], error: null })
      .mockResolvedValue({ data: [movedCandidate], error: null });
    renderRoute("/pipeline");

    await user.selectOptions(
      await screen.findByRole("combobox", {
        name: "佐藤 健太のパイプラインステージ",
      }),
      "内定",
    );

    await waitFor(() =>
      expect(candidateMocks.updateCandidate).toHaveBeenCalledWith("c-001", {
        candidate_status: "offered",
      }),
    );
    expect(
      within(screen.getByRole("region", { name: "内定列" })).getByRole(
        "article",
        { name: "佐藤 健太の候補者カード" },
      ),
    ).toBeInTheDocument();
  });

  it("レポートにSupabase由来の月次集計を表示する", async () => {
    renderRoute("/reports");

    expect(
      await screen.findByRole("heading", { name: "ステージ別人数" }),
    ).toBeInTheDocument();
    const newCandidateMetric = screen.getByText("新規候補者").parentElement;
    expect(newCandidateMetric).not.toBeNull();
    expect(
      within(newCandidateMetric as HTMLElement).getByText("1"),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "選考中 1人" })).toBeInTheDocument();
    expect(screen.getByLabelText("レポート集計月")).toHaveValue("2026-08");
  });

  it("設定画面で自分の表示名を更新できる", async () => {
    const user = userEvent.setup();
    renderRoute("/settings");
    const displayName = await screen.findByRole("textbox", { name: "表示名" });
    await user.clear(displayName);
    await user.type(displayName, "伊東 勇大（管理担当）");
    await user.click(screen.getByRole("button", { name: "表示名を保存" }));

    await waitFor(() =>
      expect(candidateMocks.updateOwnProfile).toHaveBeenCalledWith("user-001", {
        display_name: "伊東 勇大（管理担当）",
      }),
    );
    expect(
      await screen.findByText("プロフィールを更新しました。"),
    ).toBeVisible();
  });

  it("管理者は設定画面で利用者ロールを変更できる", async () => {
    const user = userEvent.setup();
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "伊東 勇大",
          email: "agent@example.com",
          role: "admin",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
        {
          id: "user-002",
          display_name: "閲覧担当",
          email: "viewer@example.com",
          role: "viewer",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    renderRoute("/settings");
    await user.selectOptions(
      await screen.findByRole("combobox", { name: "閲覧担当のロール" }),
      "agent",
    );

    await waitFor(() =>
      expect(candidateMocks.setProfileRole).toHaveBeenCalledWith(
        "user-002",
        "agent",
      ),
    );
    expect(
      await screen.findByRole("table", { name: "監査ログ一覧" }),
    ).toBeInTheDocument();
    expect(screen.getByText("候補者ステータス、次回対応日")).toBeVisible();
    expect(candidateMocks.listAuditLogs).toHaveBeenCalledWith();
  });

  it("管理者は設定画面からエージェントを招待できる", async () => {
    const user = userEvent.setup();
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "伊東 勇大",
          email: "agent@example.com",
          role: "admin",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    renderRoute("/settings");

    await user.type(
      await screen.findByRole("textbox", { name: "メールアドレス" }),
      "new-agent@example.com",
    );
    await user.type(
      screen.getByRole("textbox", { name: "表示名（任意）" }),
      "新規 担当者",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "ロール" }),
      "agent",
    );
    await user.click(screen.getByRole("button", { name: "招待メールを送信" }));

    await waitFor(() =>
      expect(candidateMocks.inviteUser).toHaveBeenCalledWith({
        email: "new-agent@example.com",
        displayName: "新規 担当者",
        role: "agent",
      }),
    );
    expect(await screen.findByText("招待メールを送信しました。")).toBeVisible();
  });

  it("閲覧者には読み取り専用表示を出し、主要な書き込み操作を隠す", async () => {
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "閲覧担当",
          email: "agent@example.com",
          role: "viewer",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    renderRoute("/candidates");

    expect(
      await screen.findByText(
        "閲覧専用モード：データの追加・変更・アーカイブはできません。",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "新規候補者登録" }),
    ).not.toBeInTheDocument();
  });

  it("未承認ユーザーにはCRMデータを表示せず承認待ち画面を出す", async () => {
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: null,
          email: "agent@example.com",
          role: "pending",
          created_at: "2026-08-06T00:00:00Z",
          updated_at: "2026-08-06T00:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.listCandidates.mockClear();
    candidateMocks.listCandidateViews.mockClear();
    candidateMocks.listApplications.mockClear();
    candidateMocks.listActivities.mockClear();
    candidateMocks.listTasks.mockClear();
    candidateMocks.listEmailThreads.mockClear();
    renderRoute("/");

    expect(
      await screen.findByRole("heading", { name: "利用承認をお待ちください" }),
    ).toBeVisible();
    expect(screen.queryByText("今日の対応")).not.toBeInTheDocument();
    expect(candidateMocks.listCandidates).not.toHaveBeenCalled();
    expect(candidateMocks.listCandidateViews).not.toHaveBeenCalled();
    expect(candidateMocks.listApplications).not.toHaveBeenCalled();
    expect(candidateMocks.listActivities).not.toHaveBeenCalled();
    expect(candidateMocks.listTasks).not.toHaveBeenCalled();
    expect(candidateMocks.listEmailThreads).not.toHaveBeenCalled();
  });

  it("ログアウト失敗時に日本語エラーを表示する", async () => {
    const user = userEvent.setup();
    authMocks.signOut.mockResolvedValueOnce({
      error: { message: "network request failed" },
    });
    renderRoute("/");

    await user.click(await screen.findByRole("button", { name: "ログアウト" }));

    expect(
      await screen.findByText(
        "ログアウトに失敗しました。時間を置いて再度お試しください。",
      ),
    ).toBeVisible();
  });

  it("閲覧者はパイプラインを確認できるがカードを移動できない", async () => {
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "閲覧担当",
          email: "agent@example.com",
          role: "viewer",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    renderRoute("/pipeline");

    expect(
      await screen.findByText(
        "閲覧権限ではパイプラインのステータスを変更できません。",
      ),
    ).toBeVisible();
    expect(
      screen.getByRole("article", {
        name: "佐藤 健太の候補者カード",
      }),
    ).toHaveAttribute("draggable", "false");
  });

  it("閲覧者の候補者詳細には編集・追加・AI生成操作を表示しない", async () => {
    const user = userEvent.setup();
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "閲覧担当",
          email: "viewer@example.com",
          role: "viewer",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    renderRoute("/candidates/c-001");

    expect(
      await screen.findByRole("heading", { name: "佐藤 健太" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: "候補者を編集" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "活動追加" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "求人提案" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "タスク追加" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "AI" }));
    expect(
      screen.queryByRole("button", { name: "AIサマリーを生成" }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["/jobs/j-001", "求人を編集"],
    ["/companies/company-001", "編集"],
  ])("閲覧者の詳細画面 %s に編集操作を表示しない", async (path, editLabel) => {
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "閲覧担当",
          email: "viewer@example.com",
          role: "viewer",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    renderRoute(path);

    expect(
      await screen.findByRole("heading", {
        name: path.startsWith("/jobs")
          ? "TAVI製品 営業担当"
          : "メディカルデバイス株式会社",
      }),
    ).toBeVisible();
    expect(
      screen.queryByRole("link", { name: editLabel }),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["/candidates/new", "候補者を登録"],
    ["/candidates/c-001/edit", "候補者を更新"],
    ["/jobs/new", "求人を登録"],
    ["/jobs/j-001/edit", "求人を更新"],
    ["/companies/new", "企業を登録"],
    ["/companies/company-001/edit", "企業を更新"],
  ])(
    "閲覧者が編集ルート %s を直接開いてもフォームを表示しない",
    async (path, submitLabel) => {
      candidateMocks.listProfiles.mockResolvedValue({
        data: [
          {
            id: "user-001",
            display_name: "閲覧担当",
            email: "viewer@example.com",
            role: "viewer",
            created_at: "2026-08-01T00:00:00Z",
            updated_at: "2026-08-01T00:00:00Z",
          },
        ],
        error: null,
      });
      renderRoute(path);

      expect(
        await screen.findByRole("heading", { name: "閲覧専用アカウントです" }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: submitLabel }),
      ).not.toBeInTheDocument();
    },
  );

  it("閲覧者には招待・ロール変更・監査ログ・AI利用管理を表示しない", async () => {
    candidateMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "閲覧担当",
          email: "viewer@example.com",
          role: "viewer",
          created_at: "2026-08-01T00:00:00Z",
          updated_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
    candidateMocks.listAuditLogs.mockClear();
    renderRoute("/settings");

    expect(
      await screen.findByRole("heading", { name: "設定", level: 2 }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "招待メールを送信" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: "閲覧担当のロール" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: "監査ログ一覧" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("AI利用状況")).not.toBeInTheDocument();
    expect(candidateMocks.listAuditLogs).not.toHaveBeenCalled();
  });

  it.each([
    ["/", "今日のホーム"],
    ["/candidates", "候補者"],
    ["/candidates/c-001", "佐藤 健太"],
    ["/candidates/new", "新規候補者登録"],
    ["/candidates/c-001/edit", "佐藤 健太を編集"],
    ["/jobs", "求人一覧"],
    ["/jobs/new", "新規求人登録"],
    ["/jobs/j-001", "TAVI製品 営業担当"],
    ["/jobs/j-001/edit", "TAVI製品 営業担当を編集"],
    ["/companies", "企業管理"],
    ["/companies/new", "新規企業登録"],
    ["/companies/company-001", "メディカルデバイス株式会社"],
    ["/companies/company-001/edit", "メディカルデバイス株式会社を編集"],
    ["/inbox", "Inbox"],
    ["/today", "今日の予定"],
    ["/tasks", "タスク一覧"],
    ["/reports", "レポート"],
    ["/settings", "設定"],
  ])("主要ルート %s でエラーが発生しない", async (path, heading) => {
    renderRoute(path);
    expect(
      await screen.findByRole("heading", {
        name: heading,
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Unexpected Application Error"),
    ).not.toBeInTheDocument();
  });
});
