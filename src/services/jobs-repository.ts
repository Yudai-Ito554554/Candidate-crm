import {
  executePaginatedSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type { JobInsert, JobRow, JobUpdate } from "@/types/database";

export function listJobs(): Promise<RepositoryResult<JobRow[]>> {
  return executePaginatedSelect<JobRow>((client, from, to) =>
    client
      .from("jobs")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function listArchivedJobs(): Promise<RepositoryResult<JobRow[]>> {
  return executePaginatedSelect<JobRow>((client, from, to) =>
    client
      .from("jobs")
      .select("*")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function createJob(
  values: JobInsert,
): Promise<RepositoryResult<JobRow>> {
  return executeSingle<JobRow>((client) =>
    client.from("jobs").insert(values).select("*").single(),
  );
}

export function updateJob(
  jobId: string,
  values: JobUpdate,
): Promise<RepositoryResult<JobRow>> {
  return executeSingle<JobRow>((client) =>
    client
      .from("jobs")
      .update(values)
      .eq("id", jobId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveJob(jobId: string): Promise<RepositoryResult<JobRow>> {
  return updateJob(jobId, { archived_at: new Date().toISOString() });
}

export function restoreJob(jobId: string): Promise<RepositoryResult<JobRow>> {
  return executeSingle<JobRow>((client) =>
    client
      .from("jobs")
      .update({ archived_at: null })
      .eq("id", jobId)
      .not("archived_at", "is", null)
      .select("*")
      .single(),
  );
}
