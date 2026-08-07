import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { generateMutate } = vi.hoisted(() => ({
  generateMutate: vi.fn(),
}));

vi.mock("@/features/access/editor-only", () => ({
  EditorOnly: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/features/candidates/candidate-queries", () => ({
  useProfilesQuery: () => ({
    data: [{ id: "user-1", role: "agent" }],
    error: null,
    isPending: false,
  }),
}));

const { usageQueryMock } = vi.hoisted(() => ({
  usageQueryMock: vi.fn(),
}));

vi.mock("@/features/settings/ai-usage-queries", () => ({
  useAiUsageQuery: usageQueryMock,
}));

vi.mock("@/features/ai/ai-summary-queries", () => ({
  useCandidateAiSummariesQuery: () => ({
    data: [],
    error: null,
    isPending: false,
  }),
  useGenerateCandidateSummaryMutation: () => ({
    error: null,
    isPending: false,
    mutate: generateMutate,
  }),
  useReviewAiSummaryMutation: () => ({
    error: null,
    isPending: false,
    mutate: vi.fn(),
  }),
}));

import { CandidateAi } from "@/components/candidate/candidate-ai";

describe("CandidateAi", () => {
  beforeEach(() => {
    usageQueryMock.mockReturnValue({ data: undefined });
  });

  it("shows an in-page billing confirmation before generation", async () => {
    const user = userEvent.setup();
    render(<CandidateAi candidateId="candidate-1" />);

    await user.click(screen.getByRole("button", { name: "AIサマリーを生成" }));

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(generateMutate).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole("button", { name: "料金を確認して生成する" }),
    );

    expect(generateMutate).toHaveBeenCalledTimes(1);
  });

  it("disables generation when the current user has exhausted the limit", () => {
    usageQueryMock.mockReturnValue({
      data: {
        generatedAt: "2026-08-07T00:00:00.000Z",
        limits: { hourly: 20, daily: 50 },
        totals: {
          lastHour: 20,
          last24Hours: 20,
          completed: 20,
          failed: 0,
          running: 0,
        },
        byFeature: {
          candidate_summary: {
            lastHour: 20,
            last24Hours: 20,
            completed: 20,
            failed: 0,
            running: 0,
          },
          job_import: {
            lastHour: 0,
            last24Hours: 0,
            completed: 0,
            failed: 0,
            running: 0,
          },
        },
        byUser: [
          {
            userId: "user-1",
            lastHour: 20,
            last24Hours: 20,
            completed: 20,
            failed: 0,
            running: 0,
          },
        ],
      },
    });

    render(<CandidateAi candidateId="candidate-1" />);

    expect(
      screen.getByRole("button", { name: "AIサマリーを生成" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("上限到達");
  });
});
