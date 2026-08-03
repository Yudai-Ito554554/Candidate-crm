import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SetupPage } from "@/pages/setup-page";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SetupPage />
    </QueryClientProvider>,
  );
}

describe("SetupPage", () => {
  it("セットアップ完了メッセージを表示する", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Candidate CRM" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("開発環境のセットアップが完了しました"),
    ).toBeInTheDocument();
  });

  it("環境を確認できる", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole("button", { name: "セットアップを確認" }),
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "開発環境を確認しました",
    );
  });
});
