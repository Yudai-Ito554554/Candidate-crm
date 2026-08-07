import { AlertTriangle, Bot, RefreshCw } from "lucide-react";
import { useMemo } from "react";

import { SectionCard } from "@/components/common/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import {
  aiUsageLevelLabels,
  getAiUsageLevel,
  type AiUsageLevel,
} from "@/features/settings/ai-usage-model";
import { useAiUsageQuery } from "@/features/settings/ai-usage-queries";
import { cn } from "@/lib/utils";
import type { ProfileRow } from "@/types/database";

interface AiUsagePanelProps {
  profiles: ProfileRow[];
  currentUserId: string;
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTokens(value: number | undefined) {
  return new Intl.NumberFormat("ja-JP").format(value ?? 0);
}

function UsageMeter({ used, limit }: { used: number; limit: number }) {
  const percent = Math.min((used / limit) * 100, 100);
  const remaining = Math.max(limit - used, 0);
  const level = getAiUsageLevel(used, limit);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xl font-semibold tabular-nums text-slate-900">
          {used}
          <span className="ml-1 text-xs font-normal text-slate-500">
            / {limit}回
          </span>
        </span>
        <span
          className={cn(
            "text-xs",
            level === "normal"
              ? "text-slate-500"
              : "font-medium text-amber-700",
            level === "exhausted" && "text-rose-700",
          )}
        >
          残り{remaining}回
        </span>
      </div>
      <div
        aria-label={`${limit}回中${used}回使用`}
        aria-valuemax={limit}
        aria-valuemin={0}
        aria-valuenow={Math.min(used, limit)}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
      >
        <div
          className={cn(
            "h-full rounded-full",
            level === "normal" && "bg-blue-600",
            level === "warning" && "bg-amber-400",
            level === "critical" && "bg-amber-600",
            level === "exhausted" && "bg-rose-600",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1.5 text-[11px]",
          level === "normal" ? "text-slate-500" : "font-medium text-amber-700",
          level === "exhausted" && "text-rose-700",
        )}
      >
        {aiUsageLevelLabels[level]}
      </p>
    </div>
  );
}

const usageLevelPriority: Record<AiUsageLevel, number> = {
  normal: 0,
  warning: 1,
  critical: 2,
  exhausted: 3,
};

function getHighestUsageLevel(
  hourlyUsed: number,
  hourlyLimit: number,
  dailyUsed: number,
  dailyLimit: number,
) {
  const hourly = getAiUsageLevel(hourlyUsed, hourlyLimit);
  const daily = getAiUsageLevel(dailyUsed, dailyLimit);
  return usageLevelPriority[hourly] >= usageLevelPriority[daily]
    ? hourly
    : daily;
}

export function AiUsagePanel({ profiles, currentUserId }: AiUsagePanelProps) {
  const usage = useAiUsageQuery(true);
  const profileNames = useMemo(
    () =>
      new Map(
        profiles.map((profile) => [
          profile.id,
          profile.display_name ?? profile.email ?? "表示名未設定",
        ]),
      ),
    [profiles],
  );
  const currentUserUsage = usage.data?.byUser.find(
    (row) => row.userId === currentUserId,
  );
  const currentUserLevel = usage.data
    ? getHighestUsageLevel(
        currentUserUsage?.lastHour ?? 0,
        usage.data.limits.hourly,
        currentUserUsage?.last24Hours ?? 0,
        usage.data.limits.daily,
      )
    : "normal";

  return (
    <SectionCard
      action={
        <Button
          aria-label="AI利用状況を再読み込み"
          disabled={usage.isFetching}
          onClick={() => void usage.refetch()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RefreshCw
            aria-hidden="true"
            className={cn("mr-1.5 size-4", usage.isFetching && "animate-spin")}
          />
          更新
        </Button>
      }
      className="mt-4"
      description="候補者サマリーと求人票読み取りを合算します。本文やAI出力は表示・保存しません。"
      title="AI利用状況"
    >
      {usage.isPending ? (
        <p className="py-8 text-center text-sm text-slate-500">
          AI利用状況を読み込んでいます…
        </p>
      ) : usage.error ? (
        <EmptyState message={usage.error.message} />
      ) : usage.data ? (
        <div className="space-y-4">
          {currentUserLevel !== "normal" ? (
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900",
                currentUserLevel === "exhausted" &&
                  "border-rose-200 bg-rose-50 text-rose-900",
              )}
              role="alert"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <p>
                AI利用枠が「{aiUsageLevelLabels[currentUserLevel]}」です。
                {currentUserLevel === "exhausted"
                  ? "利用枠が回復するまで新しい生成は実行できません。"
                  : "必要な生成を優先し、連続実行を控えてください。"}
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">
                自分の直近1時間
              </p>
              <UsageMeter
                limit={usage.data.limits.hourly}
                used={currentUserUsage?.lastHour ?? 0}
              />
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="mb-2 text-xs font-medium text-slate-600">
                自分の直近24時間
              </p>
              <UsageMeter
                limit={usage.data.limits.daily}
                used={currentUserUsage?.last24Hours ?? 0}
              />
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">
                チームの処理結果（24時間）
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge value={`成功 ${usage.data.totals.completed}`} />
                <Badge value={`失敗 ${usage.data.totals.failed}`} />
                <Badge value={`実行中 ${usage.data.totals.running}`} />
              </div>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">
                チームの機能別（24時間）
              </p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">候補者サマリー</dt>
                  <dd className="font-medium tabular-nums">
                    {usage.data.byFeature.candidate_summary.last24Hours}回
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">求人票読み取り</dt>
                  <dd className="font-medium tabular-nums">
                    {usage.data.byFeature.job_import.last24Hours}回
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-md border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-600">
                チームのトークン利用（24時間）
              </p>
              <dl className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">入力</dt>
                  <dd className="font-medium tabular-nums">
                    {formatTokens(usage.data.totals.inputTokens)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">出力</dt>
                  <dd className="font-medium tabular-nums">
                    {formatTokens(usage.data.totals.outputTokens)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-slate-100 pt-1">
                  <dt className="text-slate-500">合計</dt>
                  <dd className="font-semibold tabular-nums">
                    {formatTokens(
                      (usage.data.totals.inputTokens ?? 0) +
                        (usage.data.totals.outputTokens ?? 0),
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {usage.data.byModel?.length ? (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-800">
                モデル別利用量（24時間）
              </h3>
              <TableContainer>
                <Table aria-label="モデル別AI利用状況">
                  <thead>
                    <tr>
                      <Th>モデル</Th>
                      <Th>実行回数</Th>
                      <Th>入力トークン</Th>
                      <Th>出力トークン</Th>
                      <Th>合計トークン</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.data.byModel.map((row) => (
                      <tr key={row.model}>
                        <Td className="font-mono text-xs font-medium">
                          {row.model}
                        </Td>
                        <Td className="tabular-nums">{row.last24Hours}</Td>
                        <Td className="tabular-nums">
                          {formatTokens(row.inputTokens)}
                        </Td>
                        <Td className="tabular-nums">
                          {formatTokens(row.outputTokens)}
                        </Td>
                        <Td className="font-medium tabular-nums">
                          {formatTokens(
                            (row.inputTokens ?? 0) + (row.outputTokens ?? 0),
                          )}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableContainer>
            </div>
          ) : null}

          {usage.data.byUser.length ? (
            <TableContainer>
              <Table aria-label="利用者別AI利用状況">
                <thead>
                  <tr>
                    <Th>利用者</Th>
                    <Th>1時間</Th>
                    <Th>24時間</Th>
                    <Th>成功</Th>
                    <Th>失敗</Th>
                    <Th>実行中</Th>
                    <Th>入力トークン</Th>
                    <Th>出力トークン</Th>
                    <Th>利用枠</Th>
                  </tr>
                </thead>
                <tbody>
                  {usage.data.byUser.map((row) => {
                    const level = getHighestUsageLevel(
                      row.lastHour,
                      usage.data.limits.hourly,
                      row.last24Hours,
                      usage.data.limits.daily,
                    );
                    return (
                      <tr key={row.userId}>
                        <Td className="font-medium">
                          {profileNames.get(row.userId) ?? "削除済み利用者"}
                        </Td>
                        <Td className="tabular-nums">{row.lastHour}</Td>
                        <Td className="tabular-nums">{row.last24Hours}</Td>
                        <Td className="tabular-nums">{row.completed}</Td>
                        <Td className="tabular-nums">{row.failed}</Td>
                        <Td className="tabular-nums">{row.running}</Td>
                        <Td className="tabular-nums">
                          {formatTokens(row.inputTokens)}
                        </Td>
                        <Td className="tabular-nums">
                          {formatTokens(row.outputTokens)}
                        </Td>
                        <Td>
                          <span
                            className={cn(
                              "text-xs",
                              level === "normal"
                                ? "text-slate-600"
                                : "font-medium text-amber-700",
                              level === "exhausted" && "text-rose-700",
                            )}
                          >
                            {aiUsageLevelLabels[level]}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </TableContainer>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-md bg-slate-50 py-5 text-sm text-slate-500">
              <Bot aria-hidden="true" className="size-4" />
              直近24時間のAI利用はありません
            </div>
          )}

          <p className="text-right text-[11px] text-slate-400">
            集計日時：{formatTimestamp(usage.data.generatedAt)}（1分ごとに更新）
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
