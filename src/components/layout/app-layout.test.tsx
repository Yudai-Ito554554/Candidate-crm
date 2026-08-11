import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  environment: {
    success: true as const,
    data: {
      VITE_APP_ENV: "staging",
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
  },
  useAccessResult: {
    profile: undefined as { id: string } | undefined,
    role: "pending",
    canWrite: false,
    isAdmin: false,
    isPending: false,
    error: null,
  },
}));

vi.mock("@/lib/env", () => ({
  environment: mocks.environment,
}));

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({
    user: { email: "pending-user@example.com" },
    signOut: vi.fn(),
    errorMessage: null,
  }),
}));

vi.mock("@/features/access/use-access", () => ({
  useAccess: () => mocks.useAccessResult,
}));

import { AppLayout } from "@/components/layout/app-layout";

describe("AppLayout: 承認待ち・確認中画面のSTAGING表示", () => {
  beforeEach(() => {
    mocks.environment.data.VITE_APP_ENV = "staging";
    mocks.useAccessResult.isPending = false;
    mocks.useAccessResult.role = "pending";
  });

  it("アクセス権限確認中の画面でSTAGINGバッジを表示する", () => {
    mocks.useAccessResult.isPending = true;
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(screen.getByText("STAGING")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "アクセス権限を確認しています",
    );
  });

  it("利用承認待ち画面でSTAGINGバッジを表示し、業務データは表示しない", () => {
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "利用承認をお待ちください" }),
    ).toBeVisible();
    expect(screen.getByText("STAGING")).toBeVisible();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("候補者")).not.toBeInTheDocument();
  });

  it("停止済みユーザーには停止画面を表示し、業務データは表示しない", () => {
    mocks.useAccessResult.role = "suspended";
    render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", {
        name: "このアカウントは利用停止中です",
      }),
    ).toBeVisible();
    expect(screen.getByText("STAGING")).toBeVisible();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("候補者")).not.toBeInTheDocument();
  });

  it("productionでは確認中・承認待ちのどちらの画面でもSTAGINGバッジを表示しない", () => {
    mocks.environment.data.VITE_APP_ENV = "production";
    mocks.useAccessResult.isPending = true;
    const { rerender } = render(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.queryByText("STAGING")).not.toBeInTheDocument();

    mocks.useAccessResult.isPending = false;
    rerender(
      <MemoryRouter>
        <AppLayout />
      </MemoryRouter>,
    );
    expect(screen.queryByText("STAGING")).not.toBeInTheDocument();
  });
});
