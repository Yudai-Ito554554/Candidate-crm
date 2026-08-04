import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";

import { AuthProvider } from "@/features/auth/auth-provider";
import { appRoutes } from "@/router";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  environment: {
    success: true,
    data: {
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    },
  },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(() => Promise.resolve({ auth: authMocks })),
}));

const authenticatedSession = {
  access_token: "test-access-token",
  refresh_token: "test-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "user-001",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-08-04T00:00:00Z",
    email: "agent@example.com",
  },
} as Session;

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe("Candidate CRM Phase 2.5 routes", () => {
  beforeEach(() => {
    authMocks.getSession.mockResolvedValue({
      data: { session: authenticatedSession },
      error: null,
    });
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.signInWithPassword.mockResolvedValue({
      data: { session: authenticatedSession, user: authenticatedSession.user },
      error: null,
    });
    authMocks.signOut.mockResolvedValue({ error: null });
  });

  it("ホームに今日の対応とログインユーザーを表示する", async () => {
    renderRoute("/");
    expect(
      await screen.findByRole("heading", { name: "今日のホーム" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "今日の対応" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("一次面接の企業フィードバックを回収"),
    ).toBeInTheDocument();
    expect(screen.getByText("agent@example.com")).toBeInTheDocument();
  });

  it("候補者一覧から候補者詳細へ遷移できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates");
    await user.type(
      await screen.findByRole("textbox", { name: "候補者検索" }),
      "佐藤",
    );
    await user.click(screen.getByRole("link", { name: "佐藤 健太" }));
    expect(
      await screen.findByRole("heading", { name: "佐藤 健太" }),
    ).toBeInTheDocument();
  });

  it("候補者詳細の初期タブがタイムラインである", async () => {
    renderRoute("/candidates/c-001");
    expect(
      await screen.findByRole("tab", { name: "タイムライン" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "候補者タイムライン" }),
    ).toBeInTheDocument();
  });

  it("候補者詳細の各タブを切り替えられる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates/c-001");
    await screen.findByRole("tab", { name: "タイムライン" });
    const expectations = [
      ["概要", "キャリア情報"],
      ["職務経歴", "現在の職務経歴"],
      ["求人・選考", "候補者単位の進行状況"],
      ["タスク", "未完了"],
      ["ファイル", "ファイルアップロードは次のPhaseで実装予定です"],
      ["AI", "候補者サマリー"],
    ] as const;
    for (const [tab, content] of expectations) {
      await user.click(screen.getByRole("tab", { name: tab }));
      expect(screen.getByText(content)).toBeInTheDocument();
    }
  });

  it("求人一覧から求人詳細へ遷移できる", async () => {
    const user = userEvent.setup();
    renderRoute("/jobs");
    await user.click(
      await screen.findByRole("link", { name: "TAVI製品 営業担当" }),
    );
    expect(
      await screen.findByRole("heading", { name: "TAVI製品 営業担当" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "候補者" })).toBeInTheDocument();
  });

  it("Inbox画面を表示する", async () => {
    renderRoute("/inbox");
    expect(
      await screen.findByRole("heading", {
        name: "Inbox",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "メール一覧" }),
    ).toBeInTheDocument();
  });

  it("今日の予定画面を表示する", async () => {
    renderRoute("/today");
    expect(
      await screen.findByRole("heading", {
        name: "今日の予定",
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("初回キャリア面談（Zoom）")).toBeInTheDocument();
  });

  it("候補者画面でパイプライン表示へ切り替えられる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates");
    await user.click(
      await screen.findByRole("button", { name: "パイプライン" }),
    );
    expect(
      screen.getByRole("region", { name: "面談前列" }),
    ).toBeInTheDocument();
  });

  it("候補者カードをグループ化パイプライン内で移動できる", async () => {
    renderRoute("/pipeline");
    const storedData = new Map<string, string>();
    const dataTransfer = {
      effectAllowed: "none",
      setData: (type: string, value: string) => storedData.set(type, value),
      getData: (type: string) => storedData.get(type) ?? "",
    };
    fireEvent.dragStart(
      await screen.findByRole("article", { name: "加藤 遼の候補者カード" }),
      { dataTransfer },
    );
    const destination = screen.getByRole("region", { name: "面談前列" });
    fireEvent.drop(destination, { dataTransfer });
    expect(
      within(destination).getByRole("article", {
        name: "加藤 遼の候補者カード",
      }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/", "今日のホーム"],
    ["/candidates", "候補者"],
    ["/candidates/c-001", "佐藤 健太"],
    ["/jobs", "求人一覧"],
    ["/jobs/j-001", "TAVI製品 営業担当"],
    ["/inbox", "Inbox"],
    ["/today", "今日の予定"],
    ["/tasks", "タスク一覧"],
    ["/reports", "レポート"],
    ["/settings", "設定"],
  ])("主要ルート %s でエラーが発生しない", async (path, heading) => {
    renderRoute(path);
    expect(
      await screen.findByRole("heading", {
        name: heading,
        level: 2,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Unexpected Application Error"),
    ).not.toBeInTheDocument();
  });
});
