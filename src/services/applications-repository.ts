import {
  executePaginatedSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type {
  ApplicationInsert,
  ApplicationRow,
  ApplicationStatusHistoryRow,
  ApplicationUpdate,
} from "@/types/database";

export function listApplications(): Promise<
  RepositoryResult<ApplicationRow[]>
> {
  return executePaginatedSelect<ApplicationRow>((client, from, to) =>
    client
      .from("applications")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function listApplicationStatusHistory(): Promise<
  RepositoryResult<ApplicationStatusHistoryRow[]>
> {
  return executePaginatedSelect<ApplicationStatusHistoryRow>(
    (client, from, to) =>
      client
        .from("application_status_history")
        .select("*")
        .order("changed_at", { ascending: false })
        .order("id")
        .range(from, to),
  );
}

export function createApplication(
  values: ApplicationInsert,
): Promise<RepositoryResult<ApplicationRow>> {
  return executeSingle<ApplicationRow>((client) =>
    client.from("applications").insert(values).select("*").single(),
  );
}

export function updateApplication(
  applicationId: string,
  values: ApplicationUpdate,
): Promise<RepositoryResult<ApplicationRow>> {
  return executeSingle<ApplicationRow>((client) =>
    client
      .from("applications")
      .update(values)
      .eq("id", applicationId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveApplication(
  applicationId: string,
): Promise<RepositoryResult<ApplicationRow>> {
  return updateApplication(applicationId, {
    archived_at: new Date().toISOString(),
  });
}
