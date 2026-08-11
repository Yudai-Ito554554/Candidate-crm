import {
  executePaginatedSelect,
  executeSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type {
  CandidateExperienceInsert,
  CandidateExperienceRow,
  CandidateExperienceUpdate,
  CandidateInsert,
  CandidateRow,
  CandidateUpdate,
  CandidateViewRow,
} from "@/types/database";

export function listCandidates(): Promise<RepositoryResult<CandidateRow[]>> {
  return executePaginatedSelect<CandidateRow>((client, from, to) =>
    client
      .from("candidates")
      .select("*")
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function listArchivedCandidates(): Promise<
  RepositoryResult<CandidateRow[]>
> {
  return executePaginatedSelect<CandidateRow>((client, from, to) =>
    client
      .from("candidates")
      .select("*")
      .not("archived_at", "is", null)
      .order("archived_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function listCandidateViews(): Promise<
  RepositoryResult<CandidateViewRow[]>
> {
  return executePaginatedSelect<CandidateViewRow>((client, from, to) =>
    client
      .from("candidate_views")
      .select("*")
      .order("viewed_at", { ascending: false })
      .order("candidate_id")
      .range(from, to),
  );
}

export function recordCandidateView(
  candidateId: string,
): Promise<RepositoryResult<CandidateViewRow>> {
  return executeSingle<CandidateViewRow>((client) =>
    client
      .rpc("record_candidate_view", { target_candidate_id: candidateId })
      .single(),
  );
}

export function listCandidateExperiences(
  candidateId: string,
): Promise<RepositoryResult<CandidateExperienceRow[]>> {
  return executeSelect<CandidateExperienceRow>((client) =>
    client
      .from("candidate_experiences")
      .select("*")
      .eq("candidate_id", candidateId)
      .is("archived_at", null)
      .order("sort_order"),
  );
}

export function getCandidate(
  candidateId: string,
): Promise<RepositoryResult<CandidateRow>> {
  return executeSingle<CandidateRow>((client) =>
    client
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .is("archived_at", null)
      .single(),
  );
}

export function createCandidate(
  values: CandidateInsert,
): Promise<RepositoryResult<CandidateRow>> {
  return executeSingle<CandidateRow>((client) =>
    client.from("candidates").insert(values).select("*").single(),
  );
}

export function createCandidates(
  values: CandidateInsert[],
): Promise<RepositoryResult<CandidateRow[]>> {
  return executeSelect<CandidateRow>((client) =>
    client.from("candidates").insert(values).select("*"),
  );
}

export function updateCandidate(
  candidateId: string,
  values: CandidateUpdate,
): Promise<RepositoryResult<CandidateRow>> {
  return executeSingle<CandidateRow>((client) =>
    client
      .from("candidates")
      .update(values)
      .eq("id", candidateId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveCandidate(
  candidateId: string,
): Promise<RepositoryResult<CandidateRow>> {
  return updateCandidate(candidateId, {
    archived_at: new Date().toISOString(),
  });
}

export function restoreCandidate(
  candidateId: string,
): Promise<RepositoryResult<CandidateRow>> {
  return executeSingle<CandidateRow>((client) =>
    client
      .from("candidates")
      .update({ archived_at: null })
      .eq("id", candidateId)
      .not("archived_at", "is", null)
      .select("*")
      .single(),
  );
}

export function completeCandidateNextAction(
  candidateId: string,
): Promise<RepositoryResult<CandidateRow>> {
  return executeSingle<CandidateRow>((client) =>
    client
      .rpc("complete_candidate_next_action", {
        target_candidate_id: candidateId,
      })
      .single(),
  );
}

export function createCandidateExperience(
  values: CandidateExperienceInsert,
): Promise<RepositoryResult<CandidateExperienceRow>> {
  return executeSingle<CandidateExperienceRow>((client) =>
    client.from("candidate_experiences").insert(values).select("*").single(),
  );
}

export function updateCandidateExperience(
  experienceId: string,
  values: CandidateExperienceUpdate,
): Promise<RepositoryResult<CandidateExperienceRow>> {
  return executeSingle<CandidateExperienceRow>((client) =>
    client
      .from("candidate_experiences")
      .update(values)
      .eq("id", experienceId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveCandidateExperience(
  experienceId: string,
): Promise<RepositoryResult<CandidateExperienceRow>> {
  return updateCandidateExperience(experienceId, {
    archived_at: new Date().toISOString(),
  });
}
