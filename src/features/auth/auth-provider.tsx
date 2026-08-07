import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  AuthContext,
  type AuthContextValue,
} from "@/features/auth/auth-context";
import { installAuthDeepLinkListener } from "@/features/auth/auth-deep-link";
import { translateAuthError } from "@/features/auth/auth-errors";
import { environment } from "@/lib/env";
import { getSupabaseClient } from "@/lib/supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>(
    environment.success ? "loading" : "unauthenticated",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!environment.success) return;

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;
    let unsubscribeDeepLinks: (() => void) | undefined;

    void getSupabaseClient()
      .then(async (client) => {
        if (!client || !isMounted) return;

        const { data, error } = await client.auth.getSession();
        if (!isMounted) return;
        if (error) {
          setErrorMessage(
            translateAuthError(
              error.message,
              "認証状態を確認できませんでした。アプリを再起動してください。",
            ),
          );
        }
        setSession(data.session);
        setStatus(data.session ? "authenticated" : "unauthenticated");

        const { data: listener } = client.auth.onAuthStateChange(
          (event, nextSession) => {
            if (!isMounted) return;
            if (event === "SIGNED_OUT") queryClient.clear();
            setSession(nextSession);
            setStatus(nextSession ? "authenticated" : "unauthenticated");
          },
        );
        unsubscribe = () => listener.subscription.unsubscribe();

        const removeDeepLinkListener = await installAuthDeepLinkListener(
          client,
          (kind) => {
            if (!isMounted) return;
            setErrorMessage(null);
            window.history.replaceState({}, "", `/set-password?mode=${kind}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
          },
          (message) => {
            if (!isMounted) return;
            setErrorMessage(message);
            window.history.replaceState({}, "", "/login");
            window.dispatchEvent(new PopStateEvent("popstate"));
          },
        );
        if (isMounted) unsubscribeDeepLinks = removeDeepLinkListener;
        else removeDeepLinkListener();
      })
      .catch(() => {
        if (!isMounted) return;
        setErrorMessage(
          "認証状態を確認できませんでした。ネットワーク接続を確認してください。",
        );
        setStatus("unauthenticated");
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
      unsubscribeDeepLinks?.();
    };
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      errorMessage,
      clearError: () => setErrorMessage(null),
      signIn: async (email, password) => {
        const client = await getSupabaseClient();
        if (!client) return false;
        setErrorMessage(null);

        try {
          const { data, error } = await client.auth.signInWithPassword({
            email,
            password,
          });
          if (error) {
            setErrorMessage(
              translateAuthError(
                error.message,
                "ログインに失敗しました。入力内容を確認してください。",
              ),
            );
            return false;
          }

          if (!data.session) {
            setErrorMessage(
              "ログインセッションを開始できませんでした。管理者へお問い合わせください。",
            );
            return false;
          }

          setSession(data.session);
          setStatus("authenticated");
          return true;
        } catch {
          setErrorMessage(
            "認証サーバーへ接続できません。ネットワーク接続を確認してください。",
          );
          return false;
        }
      },
      signOut: async () => {
        const client = await getSupabaseClient();
        if (!client) return false;
        setErrorMessage(null);

        try {
          const { error } = await client.auth.signOut({ scope: "local" });
          if (error) {
            setErrorMessage(
              translateAuthError(
                error.message,
                "ログアウトに失敗しました。もう一度お試しください。",
              ),
            );
            return false;
          }

          queryClient.clear();
          setSession(null);
          setStatus("unauthenticated");
          return true;
        } catch {
          setErrorMessage(
            "ログアウトに失敗しました。ネットワーク接続を確認してください。",
          );
          return false;
        }
      },
    }),
    [errorMessage, queryClient, session, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
