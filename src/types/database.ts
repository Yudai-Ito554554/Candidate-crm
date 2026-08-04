export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Timestamps = {
  created_at: string;
  updated_at: string;
};

type OrganizationScoped = {
  id: string;
  organization_id: string;
};

export type OrganizationRow = Timestamps & {
  id: string;
  name: string;
};

export type ProfileRow = Timestamps & {
  id: string;
  display_name: string;
  email: string;
};

export type OrganizationMemberRow = Timestamps & {
  organization_id: string;
  user_id: string;
  role: Database["public"]["Enums"]["member_role"];
};

export type CompanyRow = OrganizationScoped &
  Timestamps & {
    name: string;
    industry: string | null;
  };

export type CandidateRow = OrganizationScoped &
  Timestamps & {
    name: string;
    birth_date: string | null;
    phone: string | null;
    email: string | null;
    location: string | null;
    current_company: string | null;
    department: string | null;
    current_role: string | null;
    employment_period: string | null;
    experience_area: string | null;
    experience_years: number | null;
    desired_role: string | null;
    desired_location: string | null;
    desired_salary: number | null;
    available_from: string | null;
    reason_for_change: string | null;
    priorities: string[];
    status: Database["public"]["Enums"]["candidate_status"];
    last_contact_date: string | null;
    next_contact_date: string | null;
    next_action: string | null;
    owner_id: string | null;
    strengths: string | null;
    concerns: string | null;
    interview_notes: string | null;
    recently_viewed_at: string | null;
  };

export type JobRow = OrganizationScoped &
  Timestamps & {
    company_id: string;
    division: string | null;
    title: string;
    role: string;
    location: string;
    salary_min: number | null;
    salary_max: number | null;
    status: Database["public"]["Enums"]["job_status"];
    hiring_manager: string | null;
  };

export type ApplicationRow = OrganizationScoped &
  Timestamps & {
    candidate_id: string;
    job_id: string;
    status: Database["public"]["Enums"]["application_status"];
    proposed_at: string | null;
    applied_at: string | null;
    next_step: string | null;
    next_step_date: string | null;
    decline_reason: string | null;
  };

export type TaskRow = OrganizationScoped &
  Timestamps & {
    title: string;
    due_at: string;
    priority: Database["public"]["Enums"]["task_priority"];
    task_type: Database["public"]["Enums"]["task_type"];
    status: Database["public"]["Enums"]["task_status"];
    candidate_id: string | null;
    job_id: string | null;
    assignee_id: string | null;
    completed_at: string | null;
  };

export type TimelineEventRow = OrganizationScoped &
  Timestamps & {
    candidate_id: string;
    job_id: string | null;
    occurred_at: string;
    event_type: Database["public"]["Enums"]["timeline_event_type"];
    category: Database["public"]["Enums"]["timeline_category"];
    title: string;
    content: string;
    actor_id: string | null;
    has_attachment: boolean;
    metadata: Json;
  };

export type InboxMessageRow = OrganizationScoped &
  Timestamps & {
    candidate_id: string | null;
    job_id: string | null;
    sender: string;
    sender_email: string | null;
    subject: string;
    preview: string;
    body: string;
    received_at: string;
    source_type: Database["public"]["Enums"]["inbox_source_type"];
    response_status: Database["public"]["Enums"]["response_status"];
    has_ai_draft: boolean;
    external_message_id: string | null;
  };

export type CandidateAiAnalysisRow = OrganizationScoped &
  Timestamps & {
    candidate_id: string;
    summary: string | null;
    motivation: string | null;
    strengths: string | null;
    concerns: string | null;
    interview_questions: string[];
    recommended_job_ids: string[];
    next_action: string | null;
    email_draft: string | null;
    generated_at: string | null;
  };

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDefinition<
        OrganizationRow,
        { id?: string; name: string; created_at?: string; updated_at?: string }
      >;
      profiles: TableDefinition<
        ProfileRow,
        {
          id: string;
          display_name: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      organization_members: TableDefinition<
        OrganizationMemberRow,
        {
          organization_id: string;
          user_id: string;
          role?: Database["public"]["Enums"]["member_role"];
          created_at?: string;
          updated_at?: string;
        }
      >;
      companies: TableDefinition<
        CompanyRow,
        Omit<CompanyRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      candidates: TableDefinition<
        CandidateRow,
        Omit<CandidateRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      jobs: TableDefinition<
        JobRow,
        Omit<JobRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      applications: TableDefinition<
        ApplicationRow,
        Omit<ApplicationRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      tasks: TableDefinition<
        TaskRow,
        Omit<TaskRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      timeline_events: TableDefinition<
        TimelineEventRow,
        Omit<TimelineEventRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      inbox_messages: TableDefinition<
        InboxMessageRow,
        Omit<InboxMessageRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
      candidate_ai_analyses: TableDefinition<
        CandidateAiAnalysisRow,
        Omit<CandidateAiAnalysisRow, keyof Timestamps | "id"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }
      >;
    };
    Views: Record<never, never>;
    Functions: {
      create_organization: {
        Args: { organization_name: string };
        Returns: string;
      };
      is_organization_member: {
        Args: { target_organization_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      member_role: "owner" | "admin" | "agent" | "viewer";
      candidate_status:
        | "new"
        | "first_contact"
        | "interview_scheduling"
        | "interviewed"
        | "job_proposed"
        | "application_confirming"
        | "in_selection"
        | "offered"
        | "joined"
        | "on_hold";
      job_status: "open" | "paused" | "filled";
      application_status:
        | "considering"
        | "confirming_intent"
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
      task_priority: "high" | "medium" | "low";
      task_type:
        | "candidate_contact"
        | "company_followup"
        | "interview"
        | "document"
        | "selection_followup"
        | "other";
      task_status: "not_started" | "in_progress" | "completed";
      timeline_category:
        "email" | "meeting_call" | "job_selection" | "task_note";
      timeline_event_type:
        | "zoom_meeting"
        | "phone"
        | "email_sent"
        | "email_received"
        | "job_proposed"
        | "application_intent"
        | "application"
        | "document_submitted"
        | "interview"
        | "company_followup"
        | "selection_result"
        | "task_created"
        | "note";
      inbox_source_type: "candidate" | "company" | "other";
      response_status: "unhandled" | "waiting" | "completed";
    };
    CompositeTypes: Record<never, never>;
  };
};
