import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "@/contexts/auth-context";
import { appRoutes } from "@/router";

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe("Candidate CRM Phase 2.5 routes", () => {
  it("Supabase未設定時に仮データモードを案内する", () => {
    renderRoute("/login");
    expect(screen.getByText("Supabase未設定")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "仮データモードを開く" }),
    ).toBeInTheDocument();
  });
  it("ホームに今日の対応を表示する", () => {
    renderRoute("/");
    expect(
      screen.getByRole("heading", { name: "今日のホーム" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "今日の対応" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("一次面接の企業フィードバックを回収"),
    ).toBeInTheDocument();
  });

  it("候補者一覧から候補者詳細へ遷移できる", async () => {
    const user = userEvent.setup();
    renderRoute("/candidates");
    await user.type(
      screen.getByRole("textbox", { name: "候補者検索" }),
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
    await user.click(screen.getByRole("link", { name: "TAVI製品 営業担当" }));
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
    await user.click(screen.getByRole("button", { name: "パイプライン" }));
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
