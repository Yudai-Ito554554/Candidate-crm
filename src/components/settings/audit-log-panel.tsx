import { History } from "lucide-react";
import { useMemo, useState } from "react";

import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { useAuditLogsQuery } from "@/features/settings/audit-log-queries";
import type {
  AuditAction,
  AuditActorKind,
  AuditEntityType,
  ProfileRow,
} from "@/types/database";

const actionLabels: Record<AuditAction, string> = {
  create: "作成",
  update: "更新",
  archive: "アーカイブ",
  restore: "復元",
  complete: "完了",
  reopen: "再開",
  review: "確認",
  role_change: "ロール変更",
};

const actorKindLabels: Record<AuditActorKind, string> = {
  user: "利用者",
  service: "サービス",
  system: "システム",
};

const entityLabels: Record<AuditEntityType, string> = {
  profile: "利用者",
  candidate: "候補者",
  candidate_experience: "職務経歴",
  company: "企業",
  company_contact: "企業担当者",
  job: "求人",
  application: "選考",
  activity: "活動",
  task: "タスク",
  file: "ファイル",
  email_thread: "メールスレッド",
  tag: "タグ",
  candidate_tag: "候補者タグ",
  company_tag: "企業タグ",
  job_tag: "求人タグ",
  ai_summary: "AIサマリー",
};

const fieldLabels: Record<string, string> = {
  archived_at: "アーカイブ状態",
  completed_at: "完了状態",
  reviewed_at: "確認日時",
  reviewed_by: "確認者",
  role: "ロール",
  candidate_status: "候補者ステータス",
  application_status: "選考ステータス",
  job_status: "募集状況",
  due_at: "期限",
  next_action: "次回対応",
  next_action_due_at: "次回対応日",
  waiting_on: "待ち状態",
};

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

interface AuditLogPanelProps {
  profiles: ProfileRow[];
}

export function AuditLogPanel({ profiles }: AuditLogPanelProps) {
  const auditLogs = useAuditLogsQuery(true);
  const [entityFilter, setEntityFilter] = useState<AuditEntityType | "all">(
    "all",
  );
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const profileNames = useMemo(
    () =>
      new Map(profiles.map((profile) => [profile.id, profile.display_name])),
    [profiles],
  );
  const filteredLogs = useMemo(
    () =>
      (auditLogs.data ?? []).filter(
        (log) =>
          (entityFilter === "all" || log.entity_type === entityFilter) &&
          (actionFilter === "all" || log.action === actionFilter),
      ),
    [actionFilter, auditLogs.data, entityFilter],
  );

  return (
    <SectionCard
      className="mt-4"
      description="管理者のみ閲覧できます。変更値や候補者情報の本文は監査ログへ複製しません。"
      title="監査ログ"
      action={
        <div className="flex items-center gap-2">
          <Select
            aria-label="監査対象"
            className="h-8 text-xs"
            onChange={(event) =>
              setEntityFilter(event.target.value as AuditEntityType | "all")
            }
            value={entityFilter}
          >
            <option value="all">すべての対象</option>
            {Object.entries(entityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="監査操作"
            className="h-8 text-xs"
            onChange={(event) =>
              setActionFilter(event.target.value as AuditAction | "all")
            }
            value={actionFilter}
          >
            <option value="all">すべての操作</option>
            {Object.entries(actionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      {auditLogs.isPending ? (
        <p className="py-8 text-center text-sm text-slate-500">
          監査ログを読み込んでいます…
        </p>
      ) : auditLogs.error ? (
        <EmptyState message={auditLogs.error.message} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState message="条件に一致する監査ログはありません" />
      ) : (
        <TableContainer>
          <Table aria-label="監査ログ一覧">
            <thead>
              <tr>
                <Th>日時</Th>
                <Th>経路</Th>
                <Th>実行者</Th>
                <Th>操作</Th>
                <Th>対象</Th>
                <Th>変更項目</Th>
                <Th>レコード</Th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <Td className="whitespace-nowrap text-xs">
                    {formatTimestamp(log.occurred_at)}
                  </Td>
                  <Td>
                    <Badge value={actorKindLabels[log.actor_kind]} />
                  </Td>
                  <Td className="max-w-40 truncate text-xs">
                    {log.actor_id
                      ? (profileNames.get(log.actor_id) ?? "削除済み利用者")
                      : "システム"}
                  </Td>
                  <Td>
                    <Badge value={actionLabels[log.action]} />
                  </Td>
                  <Td className="whitespace-nowrap text-xs font-medium">
                    {entityLabels[log.entity_type]}
                  </Td>
                  <Td className="max-w-80 text-xs text-slate-600">
                    {log.changed_fields.length
                      ? log.changed_fields
                          .map((field) => fieldLabels[field] ?? field)
                          .join("、")
                      : "-"}
                  </Td>
                  <Td className="font-mono text-[11px] text-slate-500">
                    {log.entity_id.slice(0, 8)}…
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableContainer>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
        <History aria-hidden="true" className="size-4" />
        最新100件を表示しています。監査ログは画面から編集・削除できません。
      </div>
    </SectionCard>
  );
}
