import type { Session, SupabaseClient } from "@supabase/supabase-js";

import {
  bootstrapSecureSession,
  deleteStoredRefreshToken,
  getLegacySessionStorageKey,
  persistAuthStateChange,
} from "@/features/auth/secure-session";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));

const supabaseUrl = "https://project-ref.supabase.co";
const oldRefreshToken = "old-refresh-token";
const rotatedRefreshToken = "rotated-refresh-token";
const session = {
  access_token: "access-token",
  refresh_token: rotatedRefreshToken,
  expires_in: 3600,
  token_type: "bearer",
  user: {
    id: "user-1",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-08-13T00:00:00Z",
  },
} as Session;

function createClient(refreshResult: unknown): {
  client: SupabaseClient;
  refreshSession: ReturnType<typeof vi.fn>;
} {
  const refreshSession = vi.fn().mockResolvedValue(refreshResult);
  return {
    client: { auth: { refreshSession } } as unknown as SupabaseClient,
    refreshSession,
  };
}

describe("secure Supabase session persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
  });

  it("保存済みrefresh tokenでセッションを復元しローテーション後の値を保存する", async () => {
    invokeMock
      .mockResolvedValueOnce(oldRefreshToken)
      .mockResolvedValueOnce(undefined);
    const { client, refreshSession } = createClient({
      data: { session },
      error: null,
    });

    await expect(bootstrapSecureSession(client, supabaseUrl)).resolves.toEqual(
      session,
    );
    expect(refreshSession).toHaveBeenCalledOnce();
    expect(refreshSession.mock.calls[0]?.[0]).toEqual({
      refresh_token: oldRefreshToken,
    });
    expect(invokeMock).toHaveBeenLastCalledWith("secure_credential_set", {
      key: "supabase-refresh-token",
      value: rotatedRefreshToken,
    });
  });

  it("失効tokenの復元失敗時に資格情報を削除する", async () => {
    invokeMock
      .mockResolvedValueOnce(oldRefreshToken)
      .mockResolvedValueOnce(undefined);
    const { client } = createClient({
      data: { session: null },
      error: { name: "AuthApiError", status: 400 },
    });

    await expect(
      bootstrapSecureSession(client, supabaseUrl),
    ).resolves.toBeNull();
    expect(invokeMock).toHaveBeenLastCalledWith("secure_credential_delete", {
      key: "supabase-refresh-token",
    });
  });

  it("一時的なネットワーク障害では保存済みtokenを削除しない", async () => {
    invokeMock.mockResolvedValueOnce(oldRefreshToken);
    const { client } = createClient({
      data: { session: null },
      error: { name: "AuthRetryableFetchError", status: 0 },
    });

    await expect(
      bootstrapSecureSession(client, supabaseUrl),
    ).resolves.toBeNull();
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).not.toHaveBeenCalledWith(
      "secure_credential_delete",
      expect.anything(),
    );
  });

  it("SIGNED_OUTで資格情報を削除する", async () => {
    invokeMock.mockResolvedValue(undefined);

    await persistAuthStateChange("SIGNED_OUT", null);

    expect(invokeMock).toHaveBeenCalledWith("secure_credential_delete", {
      key: "supabase-refresh-token",
    });
  });

  it("TOKEN_REFRESHEDで最新tokenへ上書きする", async () => {
    invokeMock.mockResolvedValue(undefined);

    await persistAuthStateChange("TOKEN_REFRESHED", session);

    expect(invokeMock).toHaveBeenCalledWith("secure_credential_set", {
      key: "supabase-refresh-token",
      value: rotatedRefreshToken,
    });
  });

  it("旧localStorageセッションを一度だけ移行し平文キーを必ず削除する", async () => {
    const legacyKey = getLegacySessionStorageKey(supabaseUrl);
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify({ refresh_token: oldRefreshToken }),
    );
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);
    const { client } = createClient({ data: { session }, error: null });

    await bootstrapSecureSession(client, supabaseUrl);

    expect(window.localStorage.getItem(legacyKey)).toBeNull();
    expect(invokeMock).toHaveBeenNthCalledWith(1, "secure_credential_set", {
      key: "supabase-refresh-token",
      value: oldRefreshToken,
    });

    invokeMock.mockClear();
    invokeMock.mockResolvedValueOnce(null);
    await expect(
      bootstrapSecureSession(client, supabaseUrl),
    ).resolves.toBeNull();
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("secure_credential_get", {
      key: "supabase-refresh-token",
    });
  });

  it("OS資格情報ストアへの移行に失敗しても旧localStorageの平文を削除する", async () => {
    const legacyKey = getLegacySessionStorageKey(supabaseUrl);
    window.localStorage.setItem(
      legacyKey,
      JSON.stringify({ refresh_token: oldRefreshToken }),
    );
    invokeMock
      .mockRejectedValueOnce(new Error("credential store unavailable"))
      .mockResolvedValueOnce(null);
    const { client } = createClient({ data: { session: null }, error: null });

    await expect(
      bootstrapSecureSession(client, supabaseUrl),
    ).resolves.toBeNull();

    expect(window.localStorage.getItem(legacyKey)).toBeNull();
    expect(invokeMock).toHaveBeenNthCalledWith(1, "secure_credential_set", {
      key: "supabase-refresh-token",
      value: oldRefreshToken,
    });
    expect(invokeMock).toHaveBeenNthCalledWith(2, "secure_credential_get", {
      key: "supabase-refresh-token",
    });
  });

  it("ログアウト用削除APIは固定key以外を渡さない", async () => {
    invokeMock.mockResolvedValue(undefined);
    await deleteStoredRefreshToken();
    expect(invokeMock).toHaveBeenCalledWith("secure_credential_delete", {
      key: "supabase-refresh-token",
    });
  });
});
