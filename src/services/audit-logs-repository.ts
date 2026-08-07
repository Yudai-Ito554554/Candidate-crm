import { executeSelect, type RepositoryResult } from "@/services/repository";
import type { AuditLogRow } from "@/types/database";

export function listAuditLogs(
  limit = 100,
): Promise<RepositoryResult<AuditLogRow[]>> {
  return executeSelect<AuditLogRow>((client) =>
    client
      .from("audit_logs")
      .select("*")
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200)),
  );
}
