import type { SupabaseClient } from "@supabase/supabase-js";

const AUTH_CALLBACK_PROTOCOL = "candidate-crm:";
const AUTH_CALLBACK_HOST = "auth";
const AUTH_CALLBACK_PATH = "/callback";

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type AuthDeepLinkKind = "invite" | "recovery";

export type AuthDeepLinkResult =
  | { kind: "ignored" }
  | { kind: "error"; message: string }
  | { kind: AuthDeepLinkKind; tokens: AuthTokens };

export function parseAuthDeepLink(value: string): AuthDeepLinkResult {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { kind: "ignored" };
  }

  if (
    url.protocol !== AUTH_CALLBACK_PROTOCOL ||
    url.hostname !== AUTH_CALLBACK_HOST ||
    url.pathname !== AUTH_CALLBACK_PATH
  ) {
    return { kind: "ignored" };
  }

  const parameters = new URLSearchParams(url.hash.replace(/^#/, ""));
  const authError = parameters.get("error_description");
  if (authError) {
    return {
      kind: "error",
      message:
        "認証リンクを確認できませんでした。リンクの有効期限を確認して、もう一度お試しください。",
    };
  }

  const type = parameters.get("type");
  if (type !== "invite" && type !== "recovery") {
    return { kind: "error", message: "対応していない認証リンクです。" };
  }

  const accessToken = parameters.get("access_token");
  const refreshToken = parameters.get("refresh_token");
  if (!accessToken || !refreshToken) {
    return {
      kind: "error",
      message: "認証リンクに必要な情報を確認できませんでした。",
    };
  }

  return { kind: type, tokens: { accessToken, refreshToken } };
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function installAuthDeepLinkListener(
  client: SupabaseClient,
  onAuthSession: (kind: AuthDeepLinkKind) => void,
  onError: (message: string) => void,
): Promise<() => void> {
  if (!isTauriRuntime()) return () => undefined;

  const { getCurrent, onOpenUrl } =
    await import("@tauri-apps/plugin-deep-link");
  let processing = false;

  const handleUrls = async (urls: string[]) => {
    if (processing) return;
    const result = urls
      .map(parseAuthDeepLink)
      .find((item) => item.kind !== "ignored");
    if (!result) return;
    if (result.kind === "error") {
      onError(result.message);
      return;
    }

    processing = true;
    try {
      const { error } = await client.auth.setSession({
        access_token: result.tokens.accessToken,
        refresh_token: result.tokens.refreshToken,
      });
      if (error) {
        onError(
          "認証セッションを開始できませんでした。リンクを再発行してください。",
        );
        return;
      }
      onAuthSession(result.kind);
    } catch {
      onError(
        "認証セッションを開始できませんでした。ネットワーク接続を確認してください。",
      );
    } finally {
      processing = false;
    }
  };

  const unlisten = await onOpenUrl((urls) => void handleUrls(urls));
  const currentUrls = await getCurrent();
  if (currentUrls?.length) void handleUrls(currentUrls);

  return unlisten;
}
