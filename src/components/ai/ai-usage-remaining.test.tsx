import { render, screen } from "@testing-library/react";

import { AiUsageRemaining } from "@/components/ai/ai-usage-remaining";
import type { AiUsageSnapshot } from "@/features/settings/ai-usage-model";

const userId = "11111111-1111-4111-8111-111111111111";
const emptyCounts = {
  lastHour: 0,
  last24Hours: 0,
  completed: 0,
  failed: 0,
  running: 0,
};

function snapshot(lastHour: number, last24Hours: number): AiUsageSnapshot {
  return {
    generatedAt: "2026-08-07T00:00:00.000Z",
    limits: { hourly: 20, daily: 50 },
    totals: emptyCounts,
    byFeature: {
      candidate_summary: emptyCounts,
      job_import: emptyCounts,
    },
    byUser: [{ userId, ...emptyCounts, lastHour, last24Hours }],
  };
}

describe("AiUsageRemaining", () => {
  it("shows the current user's hourly and daily remaining counts", () => {
    render(<AiUsageRemaining snapshot={snapshot(3, 8)} userId={userId} />);

    expect(screen.getByLabelText("AI利用残り枠")).toHaveTextContent(
      "1時間：17回",
    );
    expect(screen.getByLabelText("AI利用残り枠")).toHaveTextContent(
      "24時間：42回",
    );
    expect(screen.getByText("通常")).toBeInTheDocument();
  });

  it("shows full limits for a user with no usage rows", () => {
    const value = snapshot(0, 0);
    value.byUser = [];
    render(<AiUsageRemaining snapshot={value} userId={userId} />);

    expect(screen.getByLabelText("AI利用残り枠")).toHaveTextContent(
      "1時間：20回",
    );
    expect(screen.getByLabelText("AI利用残り枠")).toHaveTextContent(
      "24時間：50回",
    );
  });

  it("shows a recovery message when either limit is exhausted", () => {
    const value = snapshot(20, 20);
    value.byUser[0].nextHourlyRecoveryAt = "2026-08-07T01:15:00.000Z";
    render(<AiUsageRemaining snapshot={value} userId={userId} />);

    expect(screen.getByText("上限到達")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("利用再開見込み");
  });
});
