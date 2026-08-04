import type { Session } from "@supabase/supabase-js";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import {
  AuthContext,
  type AuthContextValue,
} from "@/contexts/auth-context-value";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    let unsubscribe: (() => void) | undefined;

    void getSupabaseClient()
      .then(async (client) => {
        if (!client || !isMounted) return;

        const { data, error: sessionError } = await client.auth.getSession();
        if (!isMounted) return;
        setSession(data.session);
        setError(sessionError?.message ?? null);
        setIsLoading(false);

        const { data: listener } = client.auth.onAuthStateChange(
          (_event, nextSession) => {
            if (isMounted) {
              setSession(nextSession);
              setError(null);
              setIsLoading(false);
            }
          },
        );
        unsubscribe = () => listener.subscription.unsubscribe();
      })
      .catch((reason: unknown) => {
        if (!isMounted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Supabaseクライアントの初期化に失敗しました。",
        );
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isConfigured: isSupabaseConfigured,
      isLoading,
      session,
      user: session?.user ?? null,
      error,
      signIn: async (email, password) => {
        const client = await getSupabaseClient();
        if (!client) return "Supabaseが設定されていません。";
        setError(null);
        const { error: signInError } = await client.auth.signInWithPassword({
          email,
          password,
        });
        const message = signInError?.message ?? null;
        setError(message);
        return message;
      },
      signOut: async () => {
        const client = await getSupabaseClient();
        if (!client) return "Supabaseが設定されていません。";
        const { error: signOutError } = await client.auth.signOut();
        const message = signOutError?.message ?? null;
        setError(message);
        return message;
      },
    }),
    [error, isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
