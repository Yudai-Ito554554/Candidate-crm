import {
  executePaginatedSelect,
  executeSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type {
  ActivityInsert,
  ActivityRow,
  ActivityUpdate,
} from "@/types/database";

export function listActivities(): Promise<RepositoryResult<ActivityRow[]>> {
  return executePaginatedSelect<ActivityRow>((client, from, to) =>
    client
      .from("activities")
      .select("*")
      .is("archived_at", null)
      .order("occurred_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function listCandidateActivities(
  candidateId: string,
): Promise<RepositoryResult<ActivityRow[]>> {
  return executeSelect<ActivityRow>((client) =>
    client
      .from("activities")
      .select("*")
      .eq("candidate_id", candidateId)
      .is("archived_at", null)
      .order("occurred_at", { ascending: false }),
  );
}

export function createActivity(
  values: ActivityInsert,
): Promise<RepositoryResult<ActivityRow>> {
  return executeSingle<ActivityRow>((client) =>
    client.from("activities").insert(values).select("*").single(),
  );
}

export function updateActivity(
  activityId: string,
  values: ActivityUpdate,
): Promise<RepositoryResult<ActivityRow>> {
  return executeSingle<ActivityRow>((client) =>
    client
      .from("activities")
      .update(values)
      .eq("id", activityId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveActivity(
  activityId: string,
): Promise<RepositoryResult<ActivityRow>> {
  return updateActivity(activityId, { archived_at: new Date().toISOString() });
}
