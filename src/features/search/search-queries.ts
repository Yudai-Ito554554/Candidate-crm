import { useQuery } from "@tanstack/react-query";

import { searchCrm } from "@/services/search-repository";
import type { CrmSearchResultRow } from "@/types/database";

export const searchQueryKeys = {
  global: (query: string) => ["global-search", query] as const,
};

async function runSearch(query: string): Promise<CrmSearchResultRow[]> {
  const result = await searchCrm(query);
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function useGlobalSearchQuery(query: string) {
  const normalizedQuery = query.trim();

  return useQuery({
    queryKey: searchQueryKeys.global(normalizedQuery),
    queryFn: () => runSearch(normalizedQuery),
    enabled: normalizedQuery.length >= 2,
    staleTime: 30_000,
  });
}
