import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listCandidateAiSummaries,
  reviewAiSummary,
} from "@/services/ai-summaries-repository";
import { aiUsageQueryKeys } from "@/features/settings/ai-usage-queries";
import { generateCandidateSummary } from "@/services/ai-generation-repository";
import type { RepositoryResult } from "@/services/repository";
import type { AiSummaryRow } from "@/types/database";

export const aiSummaryQueryKeys = {
  candidate: (candidateId: string) =>
    ["candidates", candidateId, "ai-summaries"] as const,
};

async function unwrap<T>(promise: Promise<RepositoryResult<T>>): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function useCandidateAiSummariesQuery(candidateId: string) {
  return useQuery({
    queryKey: aiSummaryQueryKeys.candidate(candidateId),
    queryFn: () => unwrap(listCandidateAiSummaries(candidateId)),
    enabled: Boolean(candidateId),
  });
}

export function useGenerateCandidateSummaryMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ summaryId: string }, Error>({
    mutationFn: () => unwrap(generateCandidateSummary(candidateId)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: aiSummaryQueryKeys.candidate(candidateId),
        }),
        queryClient.invalidateQueries({ queryKey: aiUsageQueryKeys.all }),
      ]);
    },
  });
}

export function useReviewAiSummaryMutation(candidateId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    AiSummaryRow,
    Error,
    { summaryId: string; reviewerId: string }
  >({
    mutationFn: ({ summaryId, reviewerId }) =>
      unwrap(reviewAiSummary(summaryId, reviewerId)),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: aiSummaryQueryKeys.candidate(candidateId),
      }),
  });
}
