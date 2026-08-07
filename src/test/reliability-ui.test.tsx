import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { AppErrorBoundary } from "@/components/common/app-error-boundary";
import { ConnectivityBanner } from "@/components/layout/connectivity-banner";
import { RouteErrorPage } from "@/pages/route-error-page";

function BrokenComponent(): never {
  throw new Error("sensitive render detail");
}

describe("application reliability UI", () => {
  it("予期しない描画例外でも白画面にしない", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <AppErrorBoundary>
        <BrokenComponent />
      </AppErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "アプリを表示できませんでした" }),
    ).toBeVisible();
    expect(
      screen.queryByText("sensitive render detail"),
    ).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("オフライン時に保存操作を避ける案内を表示する", () => {
    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    render(<ConnectivityBanner />);

    expect(screen.getByRole("alert")).toHaveTextContent("オフラインです");
    expect(screen.getByRole("alert")).toHaveTextContent("接続回復後");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: originalOnline,
    });
  });

  it("ルート読込エラーに再読み込み導線を表示する", async () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          loader: () => {
            throw new Error("private route detail");
          },
          element: <p>通常画面</p>,
          errorElement: <RouteErrorPage />,
        },
      ],
      { initialEntries: ["/"] },
    );

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", {
        name: "画面を読み込めませんでした",
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeVisible();
    expect(screen.queryByText("private route detail")).not.toBeInTheDocument();
  });
});
