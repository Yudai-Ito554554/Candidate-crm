import {
  executeSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type {
  CandidateTagInsert,
  CandidateTagRow,
  CompanyTagInsert,
  CompanyTagRow,
  JobTagInsert,
  JobTagRow,
  TagInsert,
  TagRow,
  TagUpdate,
} from "@/types/database";

export function listTags(): Promise<RepositoryResult<TagRow[]>> {
  return executeSelect<TagRow>((client) =>
    client.from("tags").select("*").is("archived_at", null).order("name"),
  );
}

export function listCandidateTags(
  candidateId: string,
): Promise<RepositoryResult<CandidateTagRow[]>> {
  return executeSelect<CandidateTagRow>((client) =>
    client
      .from("candidate_tags")
      .select("*")
      .eq("candidate_id", candidateId)
      .is("archived_at", null),
  );
}

export function createTag(
  values: TagInsert,
): Promise<RepositoryResult<TagRow>> {
  return executeSingle<TagRow>((client) =>
    client.from("tags").insert(values).select("*").single(),
  );
}

export function updateTag(
  tagId: string,
  values: TagUpdate,
): Promise<RepositoryResult<TagRow>> {
  return executeSingle<TagRow>((client) =>
    client
      .from("tags")
      .update(values)
      .eq("id", tagId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveUnusedTag(
  tagId: string,
): Promise<RepositoryResult<TagRow>> {
  return executeSingle<TagRow>((client) =>
    client.rpc("archive_unused_tag", { target_tag_id: tagId }).single(),
  );
}

export function attachCandidateTag(
  values: CandidateTagInsert,
): Promise<RepositoryResult<CandidateTagRow>> {
  return executeSingle<CandidateTagRow>((client) =>
    client.from("candidate_tags").insert(values).select("*").single(),
  );
}

export function archiveCandidateTag(
  candidateTagId: string,
): Promise<RepositoryResult<CandidateTagRow>> {
  return executeSingle<CandidateTagRow>((client) =>
    client
      .from("candidate_tags")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", candidateTagId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function listCompanyTags(
  companyId: string,
): Promise<RepositoryResult<CompanyTagRow[]>> {
  return executeSelect<CompanyTagRow>((client) =>
    client
      .from("company_tags")
      .select("*")
      .eq("company_id", companyId)
      .is("archived_at", null),
  );
}

export function listJobTags(
  jobId: string,
): Promise<RepositoryResult<JobTagRow[]>> {
  return executeSelect<JobTagRow>((client) =>
    client
      .from("job_tags")
      .select("*")
      .eq("job_id", jobId)
      .is("archived_at", null),
  );
}

export function attachCompanyTag(
  values: CompanyTagInsert,
): Promise<RepositoryResult<CompanyTagRow>> {
  return executeSingle<CompanyTagRow>((client) =>
    client.from("company_tags").insert(values).select("*").single(),
  );
}

export function archiveCompanyTag(
  companyTagId: string,
): Promise<RepositoryResult<CompanyTagRow>> {
  return executeSingle<CompanyTagRow>((client) =>
    client
      .from("company_tags")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", companyTagId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function attachJobTag(
  values: JobTagInsert,
): Promise<RepositoryResult<JobTagRow>> {
  return executeSingle<JobTagRow>((client) =>
    client.from("job_tags").insert(values).select("*").single(),
  );
}

export function archiveJobTag(
  jobTagId: string,
): Promise<RepositoryResult<JobTagRow>> {
  return executeSingle<JobTagRow>((client) =>
    client
      .from("job_tags")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", jobTagId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}
