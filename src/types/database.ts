export type ProfileRole =
  "pending" | "suspended" | "admin" | "agent" | "viewer";

export type CandidateStatus =
  | "new"
  | "contacted"
  | "interview_scheduling"
  | "interviewed"
  | "job_proposed"
  | "intention_confirming"
  | "active_selection"
  | "offered"
  | "joined"
  | "on_hold"
  | "closed";

export type WaitingOn = "self" | "candidate" | "company" | "none";
export type JobStatus = "draft" | "open" | "paused" | "closed";

export type ApplicationStatus =
  | "considering"
  | "intention_confirming"
  | "proposed"
  | "applied"
  | "document_screening"
  | "first_interview"
  | "second_interview"
  | "final_interview"
  | "offer"
  | "accepted"
  | "joined"
  | "withdrawn"
  | "rejected";

export type ActivityType =
  | "interview"
  | "phone"
  | "email_sent"
  | "email_received"
  | "job_proposed"
  | "intention_confirmed"
  | "application"
  | "document_submitted"
  | "company_contact"
  | "interview_scheduled"
  | "meeting"
  | "selection_result"
  | "task"
  | "note";

export type ActivityDirection = "inbound" | "outbound" | "internal" | "none";
export type DatabaseTaskPriority = "low" | "medium" | "high" | "urgent";
export type DatabaseTaskType =
  | "follow_up"
  | "call"
  | "email"
  | "meeting"
  | "proposal"
  | "selection"
  | "internal";
export type EmailProvider = "manual" | "gmail" | "outlook";
export type EmailParticipantType = "candidate" | "company" | "other";
export type EmailThreadStatus = "unhandled" | "waiting_reply" | "handled";
export type EmailDirection = "inbound" | "outbound";
export type CrmSearchEntityType = "candidate" | "company" | "job";
export type AuditAction =
  | "create"
  | "update"
  | "archive"
  | "restore"
  | "complete"
  | "reopen"
  | "review"
  | "role_change";
export type AuditEntityType =
  | "profile"
  | "candidate"
  | "candidate_experience"
  | "company"
  | "company_contact"
  | "job"
  | "application"
  | "activity"
  | "task"
  | "file"
  | "email_thread"
  | "tag"
  | "candidate_tag"
  | "company_tag"
  | "job_tag"
  | "ai_summary";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

interface TimestampedRow {
  created_at: string;
  updated_at: string;
}

interface ArchivableRow {
  archived_at: string | null;
}

type InsertShape<Row, RequiredKeys extends keyof Row> = Pick<
  Row,
  RequiredKeys
> &
  Partial<Omit<Row, RequiredKeys>>;

type UpdateShape<Row> = Partial<Omit<Row, "id" | "created_at" | "updated_at">>;

export interface ProfileRow extends TimestampedRow {
  id: string;
  display_name: string | null;
  email: string | null;
  role: ProfileRole;
}

export type ProfileInsert = InsertShape<ProfileRow, "id">;
export type ProfileUpdate = Pick<Partial<ProfileRow>, "display_name">;

export interface CandidateRow extends TimestampedRow, ArchivableRow {
  id: string;
  owner_id: string | null;
  full_name: string;
  full_name_kana: string | null;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  prefecture: string | null;
  current_company: string | null;
  current_department: string | null;
  current_job_title: string | null;
  current_occupation: string | null;
  candidate_status: CandidateStatus;
  desired_occupations: string[];
  desired_locations: string[];
  current_salary_min: number | null;
  current_salary_max: number | null;
  desired_salary_min: number | null;
  desired_salary_max: number | null;
  available_from: string | null;
  reason_for_change: string | null;
  priority_conditions: string | null;
  strengths: string | null;
  concerns: string | null;
  interview_summary: string | null;
  next_action: string | null;
  next_action_due_at: string | null;
  waiting_on: WaitingOn;
  last_contacted_at: string | null;
  source: string | null;
  private_notes: string | null;
}

export type CandidateInsert = InsertShape<CandidateRow, "full_name">;
export type CandidateUpdate = UpdateShape<CandidateRow>;

export interface CandidateViewRow {
  user_id: string;
  candidate_id: string;
  viewed_at: string;
  created_at: string;
}

export interface CandidateExperienceRow extends TimestampedRow, ArchivableRow {
  id: string;
  candidate_id: string;
  company_name: string | null;
  department: string | null;
  job_title: string | null;
  occupation: string | null;
  started_on: string | null;
  ended_on: string | null;
  is_current: boolean;
  experience_domain: string | null;
  responsibilities: string | null;
  achievements: string | null;
  sort_order: number;
}

export type CandidateExperienceInsert = InsertShape<
  CandidateExperienceRow,
  "candidate_id"
>;
export type CandidateExperienceUpdate = UpdateShape<CandidateExperienceRow>;

export interface CompanyRow extends TimestampedRow, ArchivableRow {
  id: string;
  name: string;
  name_kana: string | null;
  industry: string | null;
  employees: number | null;
  capital: number | null;
  listed: boolean | null;
  website: string | null;
  address: string | null;
  notes: string | null;
}

export type CompanyInsert = InsertShape<CompanyRow, "name">;
export type CompanyUpdate = UpdateShape<CompanyRow>;

export interface CompanyContactRow extends TimestampedRow, ArchivableRow {
  id: string;
  company_id: string;
  full_name: string | null;
  department: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export type CompanyContactInsert = InsertShape<CompanyContactRow, "company_id">;
export type CompanyContactUpdate = UpdateShape<CompanyContactRow>;

export interface JobRow extends TimestampedRow, ArchivableRow {
  id: string;
  company_id: string;
  contact_id: string | null;
  owner_id: string | null;
  title: string;
  division: string | null;
  occupation: string | null;
  employment_type: string | null;
  locations: string[];
  salary_min: number | null;
  salary_max: number | null;
  job_status: JobStatus;
  required_conditions: string | null;
  preferred_conditions: string | null;
  description: string | null;
  internal_notes: string | null;
  opened_at: string | null;
  closed_at: string | null;
}

export type JobInsert = InsertShape<JobRow, "company_id" | "title">;
export type JobUpdate = UpdateShape<JobRow>;

export interface ApplicationRow extends TimestampedRow, ArchivableRow {
  id: string;
  candidate_id: string;
  job_id: string;
  owner_id: string | null;
  application_status: ApplicationStatus;
  proposed_at: string | null;
  applied_at: string | null;
  next_event: string | null;
  next_event_at: string | null;
  rejection_reason: string | null;
  withdrawal_reason: string | null;
  offered_salary: number | null;
  joined_on: string | null;
  notes: string | null;
}

export type ApplicationInsert = InsertShape<
  ApplicationRow,
  "candidate_id" | "job_id"
>;
export type ApplicationUpdate = UpdateShape<ApplicationRow>;

export interface ApplicationStatusHistoryRow {
  id: string;
  application_id: string;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  changed_by: string | null;
  is_backfilled: boolean;
  changed_at: string;
}

export interface ActivityRow extends TimestampedRow, ArchivableRow {
  id: string;
  owner_id: string | null;
  candidate_id: string | null;
  company_id: string | null;
  job_id: string | null;
  application_id: string | null;
  activity_type: ActivityType;
  occurred_at: string;
  title: string;
  body: string | null;
  direction: ActivityDirection;
  external_message_id: string | null;
  ai_generated: boolean;
  metadata: Json;
}

export type ActivityInsert = InsertShape<
  ActivityRow,
  "activity_type" | "occurred_at" | "title"
>;
export type ActivityUpdate = UpdateShape<ActivityRow>;

export interface AiSummaryRow {
  id: string;
  candidate_id: string;
  generated_by: string | null;
  model: string;
  prompt_version: string;
  candidate_summary: string | null;
  change_reason_summary: string | null;
  strengths: string | null;
  concerns: string | null;
  interview_questions: string | null;
  recommended_jobs: string | null;
  next_action: string | null;
  email_draft: string | null;
  source_activity_through_at: string | null;
  generated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface CrmSearchResultRow {
  entity_type: CrmSearchEntityType;
  entity_id: string;
  primary_text: string;
  secondary_text: string | null;
  status_text: string | null;
  updated_at: string;
  rank: number;
}

export interface AuditLogRow {
  id: number;
  actor_id: string | null;
  action: AuditAction;
  entity_type: AuditEntityType;
  entity_id: string;
  changed_fields: string[];
  transaction_id: number;
  occurred_at: string;
}

export interface TaskRow extends TimestampedRow, ArchivableRow {
  id: string;
  owner_id: string | null;
  candidate_id: string | null;
  company_id: string | null;
  job_id: string | null;
  application_id: string | null;
  task_type: DatabaseTaskType;
  title: string;
  description: string | null;
  priority: DatabaseTaskPriority;
  due_at: string | null;
  completed_at: string | null;
  waiting_on: WaitingOn;
}

export type TaskInsert = InsertShape<TaskRow, "task_type" | "title">;
export type TaskUpdate = UpdateShape<TaskRow>;

export type FileCategory =
  | "resume"
  | "career_history"
  | "job_description"
  | "application_document"
  | "certificate"
  | "other";

export interface FileRow extends TimestampedRow, ArchivableRow {
  id: string;
  owner_id: string | null;
  candidate_id: string | null;
  company_id: string | null;
  job_id: string | null;
  application_id: string | null;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  category: FileCategory;
}

export type FileInsert = InsertShape<
  FileRow,
  "file_name" | "storage_path" | "category"
>;
export type FileUpdate = UpdateShape<FileRow>;

export interface EmailThreadRow extends TimestampedRow, ArchivableRow {
  id: string;
  owner_id: string | null;
  candidate_id: string | null;
  company_id: string | null;
  job_id: string | null;
  application_id: string | null;
  provider: EmailProvider;
  external_thread_id: string | null;
  subject: string;
  participant_type: EmailParticipantType;
  status: EmailThreadStatus;
  has_ai_draft: boolean;
  last_sender_name: string | null;
  last_message_preview: string | null;
  last_message_at: string;
}

export type EmailThreadInsert = InsertShape<EmailThreadRow, "subject">;
export type EmailThreadUpdate = Pick<
  Partial<EmailThreadRow>,
  "status" | "archived_at"
>;

export interface EmailMessageRow extends TimestampedRow {
  id: string;
  thread_id: string;
  activity_id: string | null;
  external_message_id: string | null;
  direction: EmailDirection;
  sender_name: string | null;
  sender_email: string;
  recipient_emails: string[];
  cc_emails: string[];
  body_text: string;
  sent_at: string;
  has_attachments: boolean;
  ai_generated: boolean;
}

export type EmailMessageInsert = InsertShape<
  EmailMessageRow,
  "thread_id" | "direction" | "sender_email" | "body_text" | "sent_at"
>;

export interface TagRow extends TimestampedRow, ArchivableRow {
  id: string;
  name: string;
  color: string | null;
}

export type TagInsert = InsertShape<TagRow, "name">;
export type TagUpdate = UpdateShape<TagRow>;

interface TagRelationRow extends ArchivableRow {
  id: string;
  tag_id: string;
  created_at: string;
}

export interface CandidateTagRow extends TagRelationRow {
  candidate_id: string;
}

export type CandidateTagInsert = InsertShape<
  CandidateTagRow,
  "candidate_id" | "tag_id"
>;
export type CandidateTagUpdate = Pick<Partial<CandidateTagRow>, "archived_at">;

export interface CompanyTagRow extends TagRelationRow {
  company_id: string;
}

export type CompanyTagInsert = InsertShape<
  CompanyTagRow,
  "company_id" | "tag_id"
>;
export type CompanyTagUpdate = Pick<Partial<CompanyTagRow>, "archived_at">;

export interface JobTagRow extends TagRelationRow {
  job_id: string;
}

export type JobTagInsert = InsertShape<JobTagRow, "job_id" | "tag_id">;
export type JobTagUpdate = Pick<Partial<JobTagRow>, "archived_at">;
