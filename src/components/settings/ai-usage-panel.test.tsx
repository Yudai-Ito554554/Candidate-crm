import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { AiUsagePanel } from "@/components/settings/ai-usage-panel";
import { useAiUsageQuery } from "@/features/settings/ai-usage-queries";
import type { ProfileRow } from "@/types/database";

vi.mock("@/features/settings/ai-usage-queries", () => ({
  useAiUsageQuery: vi.fn(),
}));

const counts = {
  lastHour: 3,
  last24Hours: 8,
  completed: 6,
  failed: 1,
  running: 1,
  inputTokens: 12_345,
  outputTokens: 678,
};

describe("AiUsagePanel", () => {
  it("shows limits, feature counts, and user totals", () => {
    vi.mocked(useAiUsageQuery).mockReturnValue({
      data: {
        generatedAt: "2026-08-07T00:00:00.000Z",
        limits: { hourly: 20, daily: 50 },
        totals: counts,
        byFeature: {
          candidate_summary: { ...counts, last24Hours: 5 },
          job_import: { ...counts, last24Hours: 3 },
        },
        byModel: [{ model: "gpt-5.6-luna", ...counts }],
        byUser: [
          {
            userId: "11111111-1111-4111-8111-111111111111",
            ...counts,
          },
        ],
      },
      error: null,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAiUsageQuery>);

    render(
      <AiUsagePanel
        currentUserId="11111111-1111-4111-8111-111111111111"
        profiles={
          [
            {
              id: "11111111-1111-4111-8111-111111111111",
              display_name: "管理者テスト",
              email: "admin@example.com",
            },
          ] as ProfileRow[]
        }
      />,
    );

    expect(screen.getByText("AI利用状況")).toBeInTheDocument();
    expect(screen.getByText("自分の直近1時間")).toBeInTheDocument();
    expect(screen.getByText("自分の直近24時間")).toBeInTheDocument();
    expect(screen.getByText("残り17回")).toBeInTheDocument();
    expect(screen.getByText("残り42回")).toBeInTheDocument();
    expect(screen.getByText("候補者サマリー")).toBeInTheDocument();
    expect(screen.getByText("求人票読み取り")).toBeInTheDocument();
    expect(
      screen.getByText("チームのトークン利用（24時間）"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("12,345").length).toBeGreaterThan(0);
    expect(screen.getAllByText("678").length).toBeGreaterThan(0);
    expect(screen.getAllByText("13,023").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("モデル別利用量（24時間）")).toBeInTheDocument();
    expect(screen.getByText("gpt-5.6-luna")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "モデル別AI利用状況" }),
    ).toBeInTheDocument();
    expect(screen.getByText("管理者テスト")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "利用者別AI利用状況" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("通常").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when the current user reaches 90 percent of a limit", () => {
    vi.mocked(useAiUsageQuery).mockReturnValue({
      data: {
        generatedAt: "2026-08-07T00:00:00.000Z",
        limits: { hourly: 20, daily: 50 },
        totals: counts,
        byFeature: {
          candidate_summary: counts,
          job_import: counts,
        },
        byUser: [
          {
            userId: "11111111-1111-4111-8111-111111111111",
            ...counts,
            lastHour: 18,
          },
        ],
      },
      error: null,
      isPending: false,
      isFetching: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAiUsageQuery>);

    render(
      <AiUsagePanel
        currentUserId="11111111-1111-4111-8111-111111111111"
        profiles={[]}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "AI利用枠が「残りわずか（90%以上）」です。",
    );
    expect(screen.getAllByText("残りわずか（90%以上）").length).toBeGreaterThan(
      0,
    );
  });
});
