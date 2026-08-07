import { useQuery } from "@tanstack/react-query";

import { listAuditLogs } from "@/services/audit-logs-repository";
import type { AuditLogRow } from "@/types/database";

export const auditLogQueryKeys = {
  all: ["audit-logs"] as const,
};

async function loadAuditLogs(): Promise<AuditLogRow[]> {
  const result = await listAuditLogs();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export function useAuditLogsQuery(enabled: boolean) {
  return useQuery({
    queryKey: auditLogQueryKeys.all,
    queryFn: loadAuditLogs,
    enabled,
    staleTime: 30_000,
  });
}
