import { executeSelect, type RepositoryResult } from "@/services/repository";
import type { CrmSearchResultRow } from "@/types/database";

export function searchCrm(
  query: string,
  limit = 12,
): Promise<RepositoryResult<CrmSearchResultRow[]>> {
  return executeSelect<CrmSearchResultRow>((client) =>
    client.rpc("search_crm", {
      query_text: query.trim(),
      result_limit: limit,
    }),
  );
}
