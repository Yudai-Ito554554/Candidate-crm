import { useQuery } from "@tanstack/react-query";

import { getAiUsageSnapshot } from "@/services/ai-usage-repository";

export const aiUsageQueryKeys = {
  all: ["ai-usage"] as const,
};

export function useAiUsageQuery(enabled: boolean) {
  return useQuery({
    queryKey: aiUsageQueryKeys.all,
    queryFn: async () => {
      const result = await getAiUsageSnapshot();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
