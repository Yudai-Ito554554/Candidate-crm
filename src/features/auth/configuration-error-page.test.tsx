import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "@/features/auth/auth-provider";
import { appRoutes } from "@/router";

vi.mock("@/lib/env", () => ({
  environment: {
    success: false,
    messages: [
      "Supabase URLが設定されていません。",
      "Supabase Publishable Keyが設定されていません。",
    ],
  },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(() => Promise.resolve(null)),
}));

describe("ConfigurationErrorPage", () => {
  it("環境変数不足時に設定エラー画面を表示する", () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ["/"] });
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Supabaseの設定が必要です" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Supabase URLが設定されていません。", {
        exact: false,
      }),
    ).toBeInTheDocument();
  });
});
