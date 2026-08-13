import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

import { AuthProvider } from "@/features/auth/auth-provider";
import { appRoutes } from "@/router";

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}));
const profileMocks = vi.hoisted(() => ({
  listProfiles: vi.fn(),
}));
const secureSessionMocks = vi.hoisted(() => ({
  bootstrapSecureSession: vi.fn(),
  deleteStoredRefreshToken: vi.fn(),
  persistAuthStateChange: vi.fn(),
  setStoredRefreshToken: vi.fn(),
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

vi.mock("@/features/auth/secure-session", () => secureSessionMocks);

vi.mock("@/services/profiles-repository", () => ({
  listProfiles: profileMocks.listProfiles,
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

function renderRoute(path: string, queryClient = new QueryClient()) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

describe("Supabase authentication flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    secureSessionMocks.bootstrapSecureSession.mockResolvedValue(null);
    secureSessionMocks.deleteStoredRefreshToken.mockResolvedValue(undefined);
    secureSessionMocks.persistAuthStateChange.mockResolvedValue(undefined);
    secureSessionMocks.setStoredRefreshToken.mockResolvedValue(undefined);
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.signOut.mockResolvedValue({ error: null });
    authMocks.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null,
    });
    profileMocks.listProfiles.mockResolvedValue({
      data: [
        {
          id: "user-001",
          display_name: "テスト担当者",
          email: "agent@example.com",
          role: "agent",
          created_at: "2026-08-04T00:00:00Z",
          updated_at: "2026-08-04T00:00:00Z",
        },
      ],
      error: null,
    });
  });

  it("未ログイン時にCRMを表示せずログイン画面へ移動する", async () => {
    renderRoute("/candidates");

    expect(
      await screen.findByRole("heading", { name: "Candidate CRM" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "候補者" }),
    ).not.toBeInTheDocument();
  });

  it("復元したセッションでCRMホームを表示する", async () => {
    secureSessionMocks.bootstrapSecureSession.mockResolvedValue(
      authenticatedSession,
    );

    renderRoute("/");

    expect(
      await screen.findByRole("heading", { name: "今日のホーム" }),
    ).toBeInTheDocument();
    expect(screen.getByText("agent@example.com")).toBeInTheDocument();
  });

  it("ログイン失敗時に日本語エラーを表示する", async () => {
    authMocks.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    });
    const user = userEvent.setup();
    renderRoute("/login");

    await user.type(
      await screen.findByLabelText("メールアドレス"),
      "agent@example.com",
    );
    await user.type(screen.getByLabelText("パスワード"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません。",
    );
  });

  it("ログイン画面からパスワード再設定へ移動してメールを送信する", async () => {
    const user = userEvent.setup();
    renderRoute("/login");

    await user.click(
      await screen.findByRole("link", { name: "パスワードを忘れた場合" }),
    );
    expect(
      await screen.findByRole("heading", { name: "パスワードを再設定" }),
    ).toBeVisible();
    await user.type(
      screen.getByLabelText("メールアドレス"),
      "agent@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "再設定メールを送信" }),
    );

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      "agent@example.com",
      { redirectTo: "candidate-crm://auth/callback" },
    );
    expect(
      await screen.findByText(/登録済みのメールアドレスであれば/),
    ).toBeVisible();
  });

  it("ログアウト後にログインへ戻りQueryキャッシュを破棄する", async () => {
    secureSessionMocks.bootstrapSecureSession.mockResolvedValue(
      authenticatedSession,
    );
    const queryClient = new QueryClient();
    queryClient.setQueryData(["candidate", "c-001"], { name: "テスト候補者" });
    const clearSpy = vi.spyOn(queryClient, "clear");
    const user = userEvent.setup();
    renderRoute("/", queryClient);

    await user.click(await screen.findByRole("button", { name: "ログアウト" }));

    expect(
      await screen.findByRole("heading", { name: "Candidate CRM" }),
    ).toBeInTheDocument();
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(clearSpy).toHaveBeenCalled();
    expect(queryClient.getQueryData(["candidate", "c-001"])).toBeUndefined();
  });
});
