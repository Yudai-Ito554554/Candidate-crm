import type { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryRouter,
  type RouteObject,
  RouterProvider,
} from "react-router-dom";

import { AuthProvider } from "@/features/auth/auth-provider";
import {
  DEFAULT_LOGIN_REDIRECT,
  resolveLoginRedirect,
  toLoginRedirectState,
} from "@/features/auth/login-redirect";
import { ProtectedRoute } from "@/features/auth/protected-route";
import { LoginPage } from "@/pages/login-page";

const authMocks = vi.hoisted(() => ({
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
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

// A minimal route table so the returned-to screen has no page dependencies.
// The real table is covered by src/pages/app-routes.test.tsx.
const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <h1>ホーム</h1> },
      { path: "/candidates/:candidateId", element: <h1>候補者詳細</h1> },
    ],
  },
];

function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return {
    router,
    ...render(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </QueryClientProvider>,
    ),
  };
}

async function signIn() {
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText("メールアドレス"),
    "agent@example.com",
  );
  await user.type(screen.getByLabelText("パスワード"), "correct-password");
  await user.click(screen.getByRole("button", { name: "ログイン" }));
}

describe("resolveLoginRedirect", () => {
  it("記録された内部ルートをそのまま返す", () => {
    expect(
      resolveLoginRedirect({ from: "/candidates/c-001?tab=activity" }),
    ).toBe("/candidates/c-001?tab=activity");
  });

  it("状態が無い場合はホームへ返す", () => {
    expect(resolveLoginRedirect(null)).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(resolveLoginRedirect(undefined)).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(resolveLoginRedirect({})).toBe(DEFAULT_LOGIN_REDIRECT);
    expect(resolveLoginRedirect({ from: 42 })).toBe(DEFAULT_LOGIN_REDIRECT);
  });

  it("アプリ外へ出る値を受け付けない", () => {
    expect(resolveLoginRedirect({ from: "https://example.com/" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(resolveLoginRedirect({ from: "//example.com/" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(resolveLoginRedirect({ from: "/\\example.com/" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(resolveLoginRedirect({ from: "javascript:alert(1)" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(resolveLoginRedirect({ from: "/\tcandidates" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
  });

  it("認証画面自身を戻り先にしない", () => {
    expect(resolveLoginRedirect({ from: "/login" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(resolveLoginRedirect({ from: "/forgot-password" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
    expect(resolveLoginRedirect({ from: "/set-password?mode=recovery" })).toBe(
      DEFAULT_LOGIN_REDIRECT,
    );
  });

  it("パス・クエリ・ハッシュを保持する", () => {
    expect(
      toLoginRedirectState({
        pathname: "/candidates/c-001",
        search: "?tab=activity",
        hash: "#notes",
      }),
    ).toEqual({ from: "/candidates/c-001?tab=activity#notes" });
  });
});

describe("ログイン後の要求ルート復帰", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    secureSessionMocks.bootstrapSecureSession.mockResolvedValue(null);
    secureSessionMocks.deleteStoredRefreshToken.mockResolvedValue(undefined);
    secureSessionMocks.persistAuthStateChange.mockResolvedValue(undefined);
    secureSessionMocks.setStoredRefreshToken.mockResolvedValue(undefined);
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    });
    authMocks.signInWithPassword.mockResolvedValue({
      data: { session: authenticatedSession, user: authenticatedSession.user },
      error: null,
    });
  });

  it("未ログインで開いた保護ルートへログイン後に戻る", async () => {
    const { router } = renderRoute("/candidates/c-001?tab=activity");

    expect(
      await screen.findByRole("heading", { name: "Candidate CRM" }),
    ).toBeInTheDocument();

    await signIn();

    expect(
      await screen.findByRole("heading", { name: "候補者詳細" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/candidates/c-001");
    expect(router.state.location.search).toBe("?tab=activity");
  });

  it("ログイン画面を直接開いた場合はホームへ入る", async () => {
    const { router } = renderRoute("/login");

    await signIn();

    expect(
      await screen.findByRole("heading", { name: "ホーム" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(DEFAULT_LOGIN_REDIRECT);
  });
});
