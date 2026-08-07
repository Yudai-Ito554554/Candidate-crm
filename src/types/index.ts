export type CandidateStatus =
  | "新規"
  | "初回連絡"
  | "面談調整"
  | "面談済み"
  | "求人提案"
  | "応募意思確認"
  | "選考中"
  | "内定"
  | "入社"
  | "保留"
  | "終了";

export type ApplicationStatus =
  | "検討中"
  | "応募意思確認"
  | "応募済み"
  | "書類選考"
  | "一次面接"
  | "二次面接"
  | "最終面接"
  | "オファー"
  | "内定"
  | "入社"
  | "辞退"
  | "見送り";

export type JobStatus = "募集中" | "募集停止" | "充足";
export type TaskPriority = "高" | "中" | "低";
export type TaskStatus = "未着手" | "対応中" | "完了";
export type TaskType =
  "候補者対応" | "企業確認" | "面談" | "書類作成" | "選考確認" | "その他";

export type ActivityType =
  "面談" | "メール" | "電話" | "求人提案" | "応募" | "企業確認";

export interface Candidate {
  id: string;
  name: string;
  birthDate: string;
  age: number;
  phone: string;
  email: string;
  location: string;
  company: string;
  department: string;
  currentRole: string;
  employmentPeriod: string;
  experienceArea: string;
  experienceYears: number;
  desiredRole: string;
  desiredLocation: string;
  desiredSalary: number;
  availableFrom: string;
  reasonForChange: string;
  priorities: string[];
  status: CandidateStatus;
  lastContactDate: string;
  nextContactDate: string;
  nextAction: string;
  owner: string;
  strengths: string;
  concerns: string;
  interviewNotes: string;
  activeApplications: number;
}

export interface Job {
  id: string;
  company: string;
  division: string;
  title: string;
  role: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  status: JobStatus;
  activeCandidates: number;
  updatedAt: string;
  hiringManager?: string;
}

export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  status: ApplicationStatus;
  appliedAt: string;
  nextStep: string;
  nextStepDate: string;
  updatedAt: string;
  proposedAt?: string;
  declineReason?: string;
}

export interface CrmTask {
  id: string;
  dueDate: string;
  priority: TaskPriority;
  title: string;
  candidateId?: string;
  jobId?: string;
  type: TaskType;
  status: TaskStatus;
}

export interface Activity {
  id: string;
  candidateId: string;
  occurredAt: string;
  type: ActivityType;
  content: string;
  jobId?: string;
}

export type TimelineCategory =
  "メール" | "面談・電話" | "求人・選考" | "タスク・メモ";

export type TimelineEventType =
  | "Zoom面談"
  | "電話"
  | "メール送信"
  | "メール受信"
  | "求人提案"
  | "応募意思確認"
  | "応募"
  | "書類提出"
  | "面接"
  | "企業確認"
  | "選考結果"
  | "タスク作成"
  | "メモ";

export interface TimelineEvent {
  id: string;
  candidateId: string;
  occurredAt: string;
  type: TimelineEventType;
  category: TimelineCategory;
  title: string;
  content: string;
  owner: string;
  jobId?: string;
  hasAttachment: boolean;
}

export type InboxCategory =
  "未対応" | "候補者から" | "企業から" | "返信待ち" | "対応済み";

export interface InboxMessage {
  id: string;
  category: InboxCategory;
  sender: string;
  subject: string;
  preview: string;
  body: string;
  candidateId?: string;
  jobId?: string;
  receivedAt: string;
  responseStatus: "未対応" | "返信待ち" | "対応済み";
  hasAiDraft: boolean;
}

export interface ScheduleItem {
  id: string;
  time: string;
  type: TaskType | "電話" | "選考期限";
  candidateId?: string;
  jobId?: string;
  content: string;
  status: "未完了" | "完了" | "期限超過";
  priority: TaskPriority;
}

export interface CandidateAiAnalysis {
  candidateId: string;
  summary: string;
  motivation: string;
  strengths: string;
  concerns: string;
  interviewQuestions: string[];
  recommendedJobs: string[];
  nextAction: string;
  emailDraft: string;
}
