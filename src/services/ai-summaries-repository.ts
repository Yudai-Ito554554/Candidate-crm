import {
  executeSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type { AiSummaryRow } from "@/types/database";

export function listCandidateAiSummaries(
  candidateId: string,
): Promise<RepositoryResult<AiSummaryRow[]>> {
  return executeSelect<AiSummaryRow>((client) =>
    client
      .from("ai_summaries")
      .select("*")
      .eq("candidate_id", candidateId)
      .is("archived_at", null)
      .order("generated_at", { ascending: false }),
  );
}

export function reviewAiSummary(
  summaryId: string,
  reviewerId: string,
): Promise<RepositoryResult<AiSummaryRow>> {
  return executeSingle<AiSummaryRow>((client) =>
    client
      .from("ai_summaries")
      .update({
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", summaryId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}
