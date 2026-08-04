import { requireSupabaseClient } from "@/lib/supabase/client";
import type {
  ApplicationRow,
  CandidateRow,
  InboxMessageRow,
  JobRow,
  OrganizationMemberRow,
  TaskRow,
  TimelineEventRow,
} from "@/types/database";

function assertQuerySucceeded(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getCurrentMembership(): Promise<OrganizationMemberRow | null> {
  const client = await requireSupabaseClient();
  const { data, error } = await client
    .from("organization_members")
    .select("*")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  assertQuerySucceeded(error);
  return data;
}

export async function createOrganization(name: string): Promise<string> {
  const client = await requireSupabaseClient();
  const { data, error } = await client.rpc("create_organization", {
    organization_name: name,
  });
  assertQuerySucceeded(error);
  if (!data) throw new Error("組織の作成結果にIDが含まれていません。");
  return data;
}

export async function listCandidates(
  organizationId: string,
): Promise<CandidateRow[]> {
  const client = await requireSupabaseClient();
  const { data, error } = await client
    .from("candidates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  assertQuerySucceeded(error);
  return data ?? [];
}

export async function listJobs(organizationId: string): Promise<JobRow[]> {
  const client = await requireSupabaseClient();
  const { data, error } = await client
    .from("jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  assertQuerySucceeded(error);
  return data ?? [];
}

export async function listApplications(
  organizationId: string,
): Promise<ApplicationRow[]> {
  const client = await requireSupabaseClient();
  const { data, error } = await client
    .from("applications")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  assertQuerySucceeded(error);
  return data ?? [];
}

export async function listTasks(organizationId: string): Promise<TaskRow[]> {
  const client = await requireSupabaseClient();
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("due_at");
  assertQuerySucceeded(error);
  return data ?? [];
}

export async function listCandidateTimeline(
  organizationId: string,
  candidateId: string,
): Promise<TimelineEventRow[]> {
  const client = await requireSupabaseClient();
  const { data, error } = await client
    .from("timeline_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("candidate_id", candidateId)
    .order("occurred_at", { ascending: false });
  assertQuerySucceeded(error);
  return data ?? [];
}

export async function listInboxMessages(
  organizationId: string,
): Promise<InboxMessageRow[]> {
  const client = await requireSupabaseClient();
  const { data, error } = await client
    .from("inbox_messages")
    .select("*")
    .eq("organization_id", organizationId)
    .order("received_at", { ascending: false });
  assertQuerySucceeded(error);
  return data ?? [];
}
