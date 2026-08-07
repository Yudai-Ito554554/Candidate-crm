import {
  aiUsageSnapshotSchema,
  getAiUsageLevel,
  getAiUsageResumeAt,
  isAiUsageExhausted,
} from "@/features/settings/ai-usage-model";

const counts = {
  lastHour: 2,
  last24Hours: 5,
  completed: 4,
  failed: 1,
  running: 0,
};

describe("AI usage model", () => {
  it("accepts a count-only usage snapshot", () => {
    const result = aiUsageSnapshotSchema.safeParse({
      generatedAt: "2026-08-07T00:00:00.000Z",
      limits: { hourly: 20, daily: 50 },
      totals: counts,
      byFeature: {
        candidate_summary: counts,
        job_import: { ...counts, lastHour: 0 },
      },
      byUser: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          ...counts,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts nonnegative provider token totals", () => {
    const tokenCounts = { ...counts, inputTokens: 12_345, outputTokens: 678 };
    const result = aiUsageSnapshotSchema.safeParse({
      generatedAt: "2026-08-07T00:00:00.000Z",
      limits: { hourly: 20, daily: 50 },
      totals: tokenCounts,
      byFeature: {
        candidate_summary: tokenCounts,
        job_import: { ...tokenCounts, inputTokens: 0, outputTokens: 0 },
      },
      byModel: [{ model: "gpt-5.6-luna", ...tokenCounts }],
      byUser: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          ...tokenCounts,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative or malformed counters", () => {
    const result = aiUsageSnapshotSchema.safeParse({
      generatedAt: "invalid",
      limits: { hourly: 20, daily: 50 },
      totals: { ...counts, failed: -1 },
      byFeature: {
        candidate_summary: counts,
        job_import: counts,
      },
      byUser: [],
    });
    expect(result.success).toBe(false);
  });

  it.each([
    [15, 20, "normal"],
    [16, 20, "warning"],
    [18, 20, "critical"],
    [20, 20, "exhausted"],
    [21, 20, "exhausted"],
  ] as const)("classifies %i of %i as %s", (used, limit, expected) => {
    expect(getAiUsageLevel(used, limit)).toBe(expected);
  });

  it("detects either the hourly or daily limit for the current user", () => {
    const snapshot = aiUsageSnapshotSchema.parse({
      generatedAt: "2026-08-07T00:00:00.000Z",
      limits: { hourly: 20, daily: 50 },
      totals: counts,
      byFeature: { candidate_summary: counts, job_import: counts },
      byUser: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          ...counts,
          lastHour: 20,
        },
      ],
    });

    expect(
      isAiUsageExhausted(snapshot, "11111111-1111-4111-8111-111111111111"),
    ).toBe(true);
    expect(
      isAiUsageExhausted(snapshot, "22222222-2222-4222-8222-222222222222"),
    ).toBe(false);
  });

  it("uses the later recovery when both rolling windows are exhausted", () => {
    const snapshot = aiUsageSnapshotSchema.parse({
      generatedAt: "2026-08-07T00:00:00.000Z",
      limits: { hourly: 20, daily: 50 },
      totals: counts,
      byFeature: { candidate_summary: counts, job_import: counts },
      byUser: [
        {
          userId: "11111111-1111-4111-8111-111111111111",
          ...counts,
          lastHour: 20,
          last24Hours: 50,
          nextHourlyRecoveryAt: "2026-08-07T01:00:00.000Z",
          nextDailyRecoveryAt: "2026-08-07T08:00:00.000Z",
        },
      ],
    });

    expect(
      getAiUsageResumeAt(snapshot, "11111111-1111-4111-8111-111111111111"),
    ).toBe("2026-08-07T08:00:00.000Z");
  });
});
