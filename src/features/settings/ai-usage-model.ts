import { z } from "zod";

const usageCountsSchema = z.object({
  lastHour: z.number().int().nonnegative(),
  last24Hours: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  running: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().optional(),
  outputTokens: z.number().int().nonnegative().optional(),
});

export const aiUsageSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  limits: z.object({
    hourly: z.number().int().positive(),
    daily: z.number().int().positive(),
  }),
  totals: usageCountsSchema,
  byFeature: z.object({
    candidate_summary: usageCountsSchema,
    job_import: usageCountsSchema,
  }),
  byModel: z
    .array(
      usageCountsSchema.extend({
        model: z.string().trim().min(1).max(100),
      }),
    )
    .optional(),
  byUser: z.array(
    usageCountsSchema.extend({
      userId: z.string().uuid(),
      nextHourlyRecoveryAt: z.string().datetime().nullable().optional(),
      nextDailyRecoveryAt: z.string().datetime().nullable().optional(),
    }),
  ),
});

export type AiUsageSnapshot = z.infer<typeof aiUsageSnapshotSchema>;

export type AiUsageLevel = "normal" | "warning" | "critical" | "exhausted";

export function getAiUsageLevel(used: number, limit: number): AiUsageLevel {
  const ratio = limit > 0 ? used / limit : 1;
  if (ratio >= 1) return "exhausted";
  if (ratio >= 0.9) return "critical";
  if (ratio >= 0.8) return "warning";
  return "normal";
}

export const aiUsageLevelLabels: Record<AiUsageLevel, string> = {
  normal: "通常",
  warning: "注意（80%以上）",
  critical: "残りわずか（90%以上）",
  exhausted: "上限到達",
};

export function isAiUsageExhausted(
  snapshot: AiUsageSnapshot | undefined,
  userId: string | undefined,
) {
  if (!snapshot || !userId) return false;
  const usage = snapshot.byUser.find((row) => row.userId === userId);
  if (!usage) return false;
  return (
    usage.lastHour >= snapshot.limits.hourly ||
    usage.last24Hours >= snapshot.limits.daily
  );
}

export function getAiUsageResumeAt(
  snapshot: AiUsageSnapshot | undefined,
  userId: string | undefined,
) {
  if (!snapshot || !userId) return null;
  const usage = snapshot.byUser.find((row) => row.userId === userId);
  if (!usage) return null;
  const exhaustedRecoveries: Array<string | undefined | null> = [];
  if (usage.lastHour >= snapshot.limits.hourly) {
    exhaustedRecoveries.push(usage.nextHourlyRecoveryAt);
  }
  if (usage.last24Hours >= snapshot.limits.daily) {
    exhaustedRecoveries.push(usage.nextDailyRecoveryAt);
  }
  if (
    !exhaustedRecoveries.length ||
    exhaustedRecoveries.some((value) => !value)
  ) {
    return null;
  }
  return exhaustedRecoveries.reduce<string>(
    (latest, value) => (value! > latest ? value! : latest),
    exhaustedRecoveries[0]!,
  );
}
