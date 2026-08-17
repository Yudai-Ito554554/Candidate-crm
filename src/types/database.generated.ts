export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          activity_type: string;
          ai_generated: boolean;
          application_id: string | null;
          archived_at: string | null;
          body: string | null;
          candidate_id: string | null;
          company_id: string | null;
          created_at: string;
          direction: string;
          external_message_id: string | null;
          id: string;
          job_id: string | null;
          metadata: Json;
          occurred_at: string;
          owner_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          activity_type: string;
          ai_generated?: boolean;
          application_id?: string | null;
          archived_at?: string | null;
          body?: string | null;
          candidate_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          direction?: string;
          external_message_id?: string | null;
          id?: string;
          job_id?: string | null;
          metadata?: Json;
          occurred_at: string;
          owner_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          activity_type?: string;
          ai_generated?: boolean;
          application_id?: string | null;
          archived_at?: string | null;
          body?: string | null;
          candidate_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          direction?: string;
          external_message_id?: string | null;
          id?: string;
          job_id?: string | null;
          metadata?: Json;
          occurred_at?: string;
          owner_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generation_requests: {
        Row: {
          candidate_id: string;
          completed_at: string | null;
          created_at: string;
          error_code: string | null;
          hash_algorithm: string | null;
          hash_key_version: number | null;
          id: string;
          input_fingerprint: string | null;
          input_schema_version: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          provider_model: string | null;
          redaction_version: string | null;
          requested_by: string | null;
          started_at: string | null;
          status: string;
        };
        Insert: {
          candidate_id: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          hash_algorithm?: string | null;
          hash_key_version?: number | null;
          id?: string;
          input_fingerprint?: string | null;
          input_schema_version?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          provider_model?: string | null;
          redaction_version?: string | null;
          requested_by?: string | null;
          started_at?: string | null;
          status?: string;
        };
        Update: {
          candidate_id?: string;
          completed_at?: string | null;
          created_at?: string;
          error_code?: string | null;
          hash_algorithm?: string | null;
          hash_key_version?: number | null;
          id?: string;
          input_fingerprint?: string | null;
          input_schema_version?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          provider_model?: string | null;
          redaction_version?: string | null;
          requested_by?: string | null;
          started_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generation_requests_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_summaries: {
        Row: {
          archived_at: string | null;
          candidate_id: string;
          candidate_summary: string | null;
          change_reason_summary: string | null;
          concerns: string | null;
          created_at: string;
          email_draft: string | null;
          generated_at: string;
          generated_by: string | null;
          id: string;
          interview_questions: string | null;
          model: string;
          next_action: string | null;
          prompt_version: string;
          recommended_jobs: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_activity_through_at: string | null;
          strengths: string | null;
        };
        Insert: {
          archived_at?: string | null;
          candidate_id: string;
          candidate_summary?: string | null;
          change_reason_summary?: string | null;
          concerns?: string | null;
          created_at?: string;
          email_draft?: string | null;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          interview_questions?: string | null;
          model: string;
          next_action?: string | null;
          prompt_version: string;
          recommended_jobs?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_activity_through_at?: string | null;
          strengths?: string | null;
        };
        Update: {
          archived_at?: string | null;
          candidate_id?: string;
          candidate_summary?: string | null;
          change_reason_summary?: string | null;
          concerns?: string | null;
          created_at?: string;
          email_draft?: string | null;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          interview_questions?: string | null;
          model?: string;
          next_action?: string | null;
          prompt_version?: string;
          recommended_jobs?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          source_activity_through_at?: string | null;
          strengths?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ai_summaries_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      application_status_history: {
        Row: {
          application_id: string;
          changed_at: string;
          changed_by: string | null;
          from_status: string | null;
          id: string;
          is_backfilled: boolean;
          to_status: string;
        };
        Insert: {
          application_id: string;
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          is_backfilled?: boolean;
          to_status: string;
        };
        Update: {
          application_id?: string;
          changed_at?: string;
          changed_by?: string | null;
          from_status?: string | null;
          id?: string;
          is_backfilled?: boolean;
          to_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "application_status_history_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
        ];
      };
      applications: {
        Row: {
          application_status: string;
          applied_at: string | null;
          archived_at: string | null;
          candidate_id: string;
          created_at: string;
          id: string;
          job_id: string;
          joined_on: string | null;
          next_event: string | null;
          next_event_at: string | null;
          notes: string | null;
          offered_salary: number | null;
          owner_id: string | null;
          proposed_at: string | null;
          rejection_reason: string | null;
          updated_at: string;
          withdrawal_reason: string | null;
        };
        Insert: {
          application_status?: string;
          applied_at?: string | null;
          archived_at?: string | null;
          candidate_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
          joined_on?: string | null;
          next_event?: string | null;
          next_event_at?: string | null;
          notes?: string | null;
          offered_salary?: number | null;
          owner_id?: string | null;
          proposed_at?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
          withdrawal_reason?: string | null;
        };
        Update: {
          application_status?: string;
          applied_at?: string | null;
          archived_at?: string | null;
          candidate_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
          joined_on?: string | null;
          next_event?: string | null;
          next_event_at?: string | null;
          notes?: string | null;
          offered_salary?: number | null;
          owner_id?: string | null;
          proposed_at?: string | null;
          rejection_reason?: string | null;
          updated_at?: string;
          withdrawal_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_kind: string;
          changed_fields: string[];
          entity_id: string;
          entity_type: string;
          id: number;
          occurred_at: string;
          transaction_id: number;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_kind?: string;
          changed_fields?: string[];
          entity_id: string;
          entity_type: string;
          id?: never;
          occurred_at?: string;
          transaction_id?: number;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_kind?: string;
          changed_fields?: string[];
          entity_id?: string;
          entity_type?: string;
          id?: never;
          occurred_at?: string;
          transaction_id?: number;
        };
        Relationships: [];
      };
      candidate_experiences: {
        Row: {
          achievements: string | null;
          archived_at: string | null;
          candidate_id: string;
          company_name: string | null;
          created_at: string;
          department: string | null;
          ended_on: string | null;
          experience_domain: string | null;
          id: string;
          is_current: boolean;
          job_title: string | null;
          occupation: string | null;
          responsibilities: string | null;
          sort_order: number;
          started_on: string | null;
          updated_at: string;
        };
        Insert: {
          achievements?: string | null;
          archived_at?: string | null;
          candidate_id: string;
          company_name?: string | null;
          created_at?: string;
          department?: string | null;
          ended_on?: string | null;
          experience_domain?: string | null;
          id?: string;
          is_current?: boolean;
          job_title?: string | null;
          occupation?: string | null;
          responsibilities?: string | null;
          sort_order?: number;
          started_on?: string | null;
          updated_at?: string;
        };
        Update: {
          achievements?: string | null;
          archived_at?: string | null;
          candidate_id?: string;
          company_name?: string | null;
          created_at?: string;
          department?: string | null;
          ended_on?: string | null;
          experience_domain?: string | null;
          id?: string;
          is_current?: boolean;
          job_title?: string | null;
          occupation?: string | null;
          responsibilities?: string | null;
          sort_order?: number;
          started_on?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_experiences_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_tags: {
        Row: {
          archived_at: string | null;
          candidate_id: string;
          created_at: string;
          id: string;
          tag_id: string;
        };
        Insert: {
          archived_at?: string | null;
          candidate_id: string;
          created_at?: string;
          id?: string;
          tag_id: string;
        };
        Update: {
          archived_at?: string | null;
          candidate_id?: string;
          created_at?: string;
          id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_tags_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "candidate_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      candidate_views: {
        Row: {
          candidate_id: string;
          created_at: string;
          user_id: string;
          viewed_at: string;
        };
        Insert: {
          candidate_id: string;
          created_at?: string;
          user_id: string;
          viewed_at?: string;
        };
        Update: {
          candidate_id?: string;
          created_at?: string;
          user_id?: string;
          viewed_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidate_views_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: {
          archived_at: string | null;
          available_from: string | null;
          birth_date: string | null;
          candidate_status: string;
          concerns: string | null;
          created_at: string;
          current_company: string | null;
          current_department: string | null;
          current_job_title: string | null;
          current_occupation: string | null;
          current_salary_max: number | null;
          current_salary_min: number | null;
          desired_locations: string[];
          desired_occupations: string[];
          desired_salary_max: number | null;
          desired_salary_min: number | null;
          email: string | null;
          full_name: string;
          full_name_kana: string | null;
          id: string;
          interview_summary: string | null;
          last_contacted_at: string | null;
          next_action: string | null;
          next_action_due_at: string | null;
          owner_id: string | null;
          phone: string | null;
          prefecture: string | null;
          priority_conditions: string | null;
          private_notes: string | null;
          reason_for_change: string | null;
          source: string | null;
          strengths: string | null;
          updated_at: string;
          waiting_on: string;
        };
        Insert: {
          archived_at?: string | null;
          available_from?: string | null;
          birth_date?: string | null;
          candidate_status?: string;
          concerns?: string | null;
          created_at?: string;
          current_company?: string | null;
          current_department?: string | null;
          current_job_title?: string | null;
          current_occupation?: string | null;
          current_salary_max?: number | null;
          current_salary_min?: number | null;
          desired_locations?: string[];
          desired_occupations?: string[];
          desired_salary_max?: number | null;
          desired_salary_min?: number | null;
          email?: string | null;
          full_name: string;
          full_name_kana?: string | null;
          id?: string;
          interview_summary?: string | null;
          last_contacted_at?: string | null;
          next_action?: string | null;
          next_action_due_at?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          prefecture?: string | null;
          priority_conditions?: string | null;
          private_notes?: string | null;
          reason_for_change?: string | null;
          source?: string | null;
          strengths?: string | null;
          updated_at?: string;
          waiting_on?: string;
        };
        Update: {
          archived_at?: string | null;
          available_from?: string | null;
          birth_date?: string | null;
          candidate_status?: string;
          concerns?: string | null;
          created_at?: string;
          current_company?: string | null;
          current_department?: string | null;
          current_job_title?: string | null;
          current_occupation?: string | null;
          current_salary_max?: number | null;
          current_salary_min?: number | null;
          desired_locations?: string[];
          desired_occupations?: string[];
          desired_salary_max?: number | null;
          desired_salary_min?: number | null;
          email?: string | null;
          full_name?: string;
          full_name_kana?: string | null;
          id?: string;
          interview_summary?: string | null;
          last_contacted_at?: string | null;
          next_action?: string | null;
          next_action_due_at?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          prefecture?: string | null;
          priority_conditions?: string | null;
          private_notes?: string | null;
          reason_for_change?: string | null;
          source?: string | null;
          strengths?: string | null;
          updated_at?: string;
          waiting_on?: string;
        };
        Relationships: [];
      };
      companies: {
        Row: {
          address: string | null;
          archived_at: string | null;
          capital: number | null;
          created_at: string;
          employees: number | null;
          id: string;
          industry: string | null;
          listed: boolean | null;
          name: string;
          name_kana: string | null;
          notes: string | null;
          updated_at: string;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          archived_at?: string | null;
          capital?: number | null;
          created_at?: string;
          employees?: number | null;
          id?: string;
          industry?: string | null;
          listed?: boolean | null;
          name: string;
          name_kana?: string | null;
          notes?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          archived_at?: string | null;
          capital?: number | null;
          created_at?: string;
          employees?: number | null;
          id?: string;
          industry?: string | null;
          listed?: boolean | null;
          name?: string;
          name_kana?: string | null;
          notes?: string | null;
          updated_at?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      company_contacts: {
        Row: {
          archived_at: string | null;
          company_id: string;
          created_at: string;
          department: string | null;
          email: string | null;
          full_name: string | null;
          id: string;
          notes: string | null;
          phone: string | null;
          position: string | null;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          company_id: string;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          company_id?: string;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          notes?: string | null;
          phone?: string | null;
          position?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
        ];
      };
      company_tags: {
        Row: {
          archived_at: string | null;
          company_id: string;
          created_at: string;
          id: string;
          tag_id: string;
        };
        Insert: {
          archived_at?: string | null;
          company_id: string;
          created_at?: string;
          id?: string;
          tag_id: string;
        };
        Update: {
          archived_at?: string | null;
          company_id?: string;
          created_at?: string;
          id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "company_tags_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "company_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      email_messages: {
        Row: {
          activity_id: string | null;
          ai_generated: boolean;
          body_text: string;
          cc_emails: string[];
          created_at: string;
          direction: string;
          external_message_id: string | null;
          has_attachments: boolean;
          id: string;
          recipient_emails: string[];
          sender_email: string;
          sender_name: string | null;
          sent_at: string;
          thread_id: string;
          updated_at: string;
        };
        Insert: {
          activity_id?: string | null;
          ai_generated?: boolean;
          body_text: string;
          cc_emails?: string[];
          created_at?: string;
          direction: string;
          external_message_id?: string | null;
          has_attachments?: boolean;
          id?: string;
          recipient_emails?: string[];
          sender_email: string;
          sender_name?: string | null;
          sent_at: string;
          thread_id: string;
          updated_at?: string;
        };
        Update: {
          activity_id?: string | null;
          ai_generated?: boolean;
          body_text?: string;
          cc_emails?: string[];
          created_at?: string;
          direction?: string;
          external_message_id?: string | null;
          has_attachments?: boolean;
          id?: string;
          recipient_emails?: string[];
          sender_email?: string;
          sender_name?: string | null;
          sent_at?: string;
          thread_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_messages_activity_id_fkey";
            columns: ["activity_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "email_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      email_threads: {
        Row: {
          application_id: string | null;
          archived_at: string | null;
          candidate_id: string | null;
          company_id: string | null;
          created_at: string;
          external_thread_id: string | null;
          has_ai_draft: boolean;
          id: string;
          job_id: string | null;
          last_message_at: string;
          last_message_preview: string | null;
          last_sender_name: string | null;
          owner_id: string | null;
          participant_type: string;
          provider: string;
          status: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          application_id?: string | null;
          archived_at?: string | null;
          candidate_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          external_thread_id?: string | null;
          has_ai_draft?: boolean;
          id?: string;
          job_id?: string | null;
          last_message_at?: string;
          last_message_preview?: string | null;
          last_sender_name?: string | null;
          owner_id?: string | null;
          participant_type?: string;
          provider?: string;
          status?: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          application_id?: string | null;
          archived_at?: string | null;
          candidate_id?: string | null;
          company_id?: string | null;
          created_at?: string;
          external_thread_id?: string | null;
          has_ai_draft?: boolean;
          id?: string;
          job_id?: string | null;
          last_message_at?: string;
          last_message_preview?: string | null;
          last_sender_name?: string | null;
          owner_id?: string | null;
          participant_type?: string;
          provider?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_threads_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_threads_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_threads_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "email_threads_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          application_id: string | null;
          archived_at: string | null;
          candidate_id: string | null;
          category: string;
          company_id: string | null;
          created_at: string;
          file_name: string;
          file_size: number | null;
          id: string;
          job_id: string | null;
          mime_type: string | null;
          owner_id: string | null;
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          application_id?: string | null;
          archived_at?: string | null;
          candidate_id?: string | null;
          category?: string;
          company_id?: string | null;
          created_at?: string;
          file_name: string;
          file_size?: number | null;
          id?: string;
          job_id?: string | null;
          mime_type?: string | null;
          owner_id?: string | null;
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          application_id?: string | null;
          archived_at?: string | null;
          candidate_id?: string | null;
          category?: string;
          company_id?: string | null;
          created_at?: string;
          file_name?: string;
          file_size?: number | null;
          id?: string;
          job_id?: string | null;
          mime_type?: string | null;
          owner_id?: string | null;
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "files_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_import_requests: {
        Row: {
          completed_at: string | null;
          error_code: string | null;
          hash_algorithm: string | null;
          hash_key_version: number | null;
          id: string;
          input_fingerprint: string | null;
          input_schema_version: string | null;
          input_tokens: number | null;
          output_tokens: number | null;
          provider_model: string | null;
          redaction_version: string | null;
          requested_by: string;
          source_type: string;
          started_at: string;
          status: string;
        };
        Insert: {
          completed_at?: string | null;
          error_code?: string | null;
          hash_algorithm?: string | null;
          hash_key_version?: number | null;
          id?: string;
          input_fingerprint?: string | null;
          input_schema_version?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          provider_model?: string | null;
          redaction_version?: string | null;
          requested_by: string;
          source_type: string;
          started_at?: string;
          status?: string;
        };
        Update: {
          completed_at?: string | null;
          error_code?: string | null;
          hash_algorithm?: string | null;
          hash_key_version?: number | null;
          id?: string;
          input_fingerprint?: string | null;
          input_schema_version?: string | null;
          input_tokens?: number | null;
          output_tokens?: number | null;
          provider_model?: string | null;
          redaction_version?: string | null;
          requested_by?: string;
          source_type?: string;
          started_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      job_tags: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          job_id: string;
          tag_id: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          job_id: string;
          tag_id: string;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_tags_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          archived_at: string | null;
          closed_at: string | null;
          company_id: string;
          contact_id: string | null;
          created_at: string;
          description: string | null;
          division: string | null;
          employment_type: string | null;
          id: string;
          internal_notes: string | null;
          job_status: string;
          locations: string[];
          occupation: string | null;
          opened_at: string | null;
          owner_id: string | null;
          preferred_conditions: string | null;
          required_conditions: string | null;
          salary_max: number | null;
          salary_min: number | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          closed_at?: string | null;
          company_id: string;
          contact_id?: string | null;
          created_at?: string;
          description?: string | null;
          division?: string | null;
          employment_type?: string | null;
          id?: string;
          internal_notes?: string | null;
          job_status?: string;
          locations?: string[];
          occupation?: string | null;
          opened_at?: string | null;
          owner_id?: string | null;
          preferred_conditions?: string | null;
          required_conditions?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          closed_at?: string | null;
          company_id?: string;
          contact_id?: string | null;
          created_at?: string;
          description?: string | null;
          division?: string | null;
          employment_type?: string | null;
          id?: string;
          internal_notes?: string | null;
          job_status?: string;
          locations?: string[];
          occupation?: string | null;
          opened_at?: string | null;
          owner_id?: string | null;
          preferred_conditions?: string | null;
          required_conditions?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "company_contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          role?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          archived_at: string | null;
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          archived_at?: string | null;
          color?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          application_id: string | null;
          archived_at: string | null;
          candidate_id: string | null;
          company_id: string | null;
          completed_at: string | null;
          created_at: string;
          description: string | null;
          due_at: string | null;
          id: string;
          job_id: string | null;
          owner_id: string | null;
          priority: string;
          task_type: string;
          title: string;
          updated_at: string;
          waiting_on: string;
        };
        Insert: {
          application_id?: string | null;
          archived_at?: string | null;
          candidate_id?: string | null;
          company_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_at?: string | null;
          id?: string;
          job_id?: string | null;
          owner_id?: string | null;
          priority?: string;
          task_type: string;
          title: string;
          updated_at?: string;
          waiting_on?: string;
        };
        Update: {
          application_id?: string | null;
          archived_at?: string | null;
          candidate_id?: string | null;
          company_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          description?: string | null;
          due_at?: string | null;
          id?: string;
          job_id?: string | null;
          owner_id?: string | null;
          priority?: string;
          task_type?: string;
          title?: string;
          updated_at?: string;
          waiting_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tasks_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_invited_profile_role: {
        Args: {
          new_role: string;
          requester_id: string;
          target_user_id: string;
        };
        Returns: undefined;
      };
      archive_unused_tag: {
        Args: { target_tag_id: string };
        Returns: {
          archived_at: string | null;
          color: string | null;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "tags";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      claim_candidate_ai_request: {
        Args: { requester_id: string; target_candidate_id: string };
        Returns: string;
      };
      claim_job_import_request: {
        Args: { request_source_type: string; requester_id: string };
        Returns: string;
      };
      complete_candidate_next_action: {
        Args: { target_candidate_id: string };
        Returns: {
          archived_at: string | null;
          available_from: string | null;
          birth_date: string | null;
          candidate_status: string;
          concerns: string | null;
          created_at: string;
          current_company: string | null;
          current_department: string | null;
          current_job_title: string | null;
          current_occupation: string | null;
          current_salary_max: number | null;
          current_salary_min: number | null;
          desired_locations: string[];
          desired_occupations: string[];
          desired_salary_max: number | null;
          desired_salary_min: number | null;
          email: string | null;
          full_name: string;
          full_name_kana: string | null;
          id: string;
          interview_summary: string | null;
          last_contacted_at: string | null;
          next_action: string | null;
          next_action_due_at: string | null;
          owner_id: string | null;
          phone: string | null;
          prefecture: string | null;
          priority_conditions: string | null;
          private_notes: string | null;
          reason_for_change: string | null;
          source: string | null;
          strengths: string | null;
          updated_at: string;
          waiting_on: string;
        };
        SetofOptions: {
          from: "*";
          to: "candidates";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      current_profile_role: { Args: never; Returns: string };
      get_ai_usage_snapshot: {
        Args: never;
        Returns: {
          completed_count: number;
          failed_count: number;
          feature: string;
          last_day_count: number;
          last_hour_count: number;
          input_token_count: number;
          next_daily_recovery_at: string | null;
          next_hourly_recovery_at: string | null;
          output_token_count: number;
          provider_model: string | null;
          requested_by: string;
          running_count: number;
        }[];
      };
      immutable_text_array_to_string: {
        Args: { delimiter: string; input_values: string[] };
        Returns: string;
      };
      record_candidate_view: {
        Args: { target_candidate_id: string };
        Returns: {
          candidate_id: string;
          created_at: string;
          user_id: string;
          viewed_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "candidate_views";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      search_crm: {
        Args: { query_text: string; result_limit?: number };
        Returns: {
          entity_id: string;
          entity_type: string;
          primary_text: string;
          rank: number;
          secondary_text: string;
          status_text: string;
          updated_at: string;
        }[];
      };
      set_profile_role: {
        Args: { new_role: string; target_user_id: string };
        Returns: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          role: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "profiles";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      store_candidate_ai_summary: {
        Args: {
          activity_through_at: string;
          provider_model: string;
          provider_prompt_version: string;
          requester_id: string;
          summary_candidate: string;
          summary_change_reason: string;
          summary_concerns: string;
          summary_email_draft: string;
          summary_interview_questions: string;
          summary_next_action: string;
          summary_recommended_jobs: string;
          summary_strengths: string;
          target_candidate_id: string;
        };
        Returns: {
          archived_at: string | null;
          candidate_id: string;
          candidate_summary: string | null;
          change_reason_summary: string | null;
          concerns: string | null;
          created_at: string;
          email_draft: string | null;
          generated_at: string;
          generated_by: string | null;
          id: string;
          interview_questions: string | null;
          model: string;
          next_action: string | null;
          prompt_version: string;
          recommended_jobs: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          source_activity_through_at: string | null;
          strengths: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "ai_summaries";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
