import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";

const REFRESH_TOKEN_KEY = "supabase-refresh-token";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function logCredentialError(operation: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  const errorType = error instanceof Error ? error.name : typeof error;
  console.warn(`[secure-session] ${operation} failed (${errorType})`);
}

async function invokeCredential<T>(
  command: string,
  arguments_: Record<string, string>,
): Promise<T> {
  if (!isTauriRuntime()) throw new Error("TauriRuntimeUnavailable");
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, arguments_);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return invokeCredential<string | null>("secure_credential_get", {
    key: REFRESH_TOKEN_KEY,
  });
}

export async function setStoredRefreshToken(value: string): Promise<void> {
  await invokeCredential<void>("secure_credential_set", {
    key: REFRESH_TOKEN_KEY,
    value,
  });
}

export async function deleteStoredRefreshToken(): Promise<void> {
  await invokeCredential<void>("secure_credential_delete", {
    key: REFRESH_TOKEN_KEY,
  });
}

export function getLegacySessionStorageKey(supabaseUrl: string): string {
  const projectReference = new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${projectReference}-auth-token`;
}

function extractLegacyRefreshToken(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "refresh_token" in parsed &&
      typeof parsed.refresh_token === "string"
    ) {
      return parsed.refresh_token;
    }
  } catch {
    return null;
  }
  return null;
}

async function migrateLegacyRefreshToken(
  supabaseUrl: string,
): Promise<string | null> {
  const legacyKey = getLegacySessionStorageKey(supabaseUrl);
  let legacyValue: string | null;
  try {
    legacyValue = window.localStorage.getItem(legacyKey);
  } catch (error) {
    logCredentialError("read legacy storage", error);
    return null;
  }
  if (legacyValue === null) return null;

  let migratedToken: string | null = null;
  try {
    const refreshToken = extractLegacyRefreshToken(legacyValue);
    if (refreshToken) {
      await setStoredRefreshToken(refreshToken);
      migratedToken = refreshToken;
    }
  } catch (error) {
    logCredentialError("legacy migration", error);
  }

  // The legacy plaintext is removed even when migration fails. We never
  // restore localStorage persistence as a credential-store fallback.
  try {
    window.localStorage.removeItem(legacyKey);
  } catch (error) {
    logCredentialError("delete legacy storage", error);
    if (migratedToken) {
      try {
        await deleteStoredRefreshToken();
      } catch (deleteError) {
        logCredentialError("rollback legacy migration", deleteError);
      }
    }
    return null;
  }

  return migratedToken;
}

function isRetryableAuthFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const name = "name" in error ? error.name : undefined;
  const status = "status" in error ? error.status : undefined;
  return (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    (typeof status === "number" && status >= 500)
  );
}

export async function bootstrapSecureSession(
  client: SupabaseClient,
  supabaseUrl: string,
): Promise<Session | null> {
  const migratedToken = await migrateLegacyRefreshToken(supabaseUrl);
  let refreshToken = migratedToken;

  if (!refreshToken) {
    try {
      refreshToken = await getStoredRefreshToken();
    } catch (error) {
      logCredentialError("read", error);
      return null;
    }
  }
  if (!refreshToken) return null;

  try {
    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      if (!isRetryableAuthFailure(error)) {
        try {
          await deleteStoredRefreshToken();
        } catch (deleteError) {
          logCredentialError("delete invalid token", deleteError);
        }
      }
      return null;
    }

    // Supabase rotates refresh tokens. Await the secure write so a clean app
    // shutdown cannot race ahead of persistence. A forced termination inside
    // this small window can require one fresh login, but never weakens storage.
    try {
      await setStoredRefreshToken(data.session.refresh_token);
    } catch (error) {
      logCredentialError("save restored token", error);
    }
    return data.session;
  } catch (error) {
    if (!isRetryableAuthFailure(error)) {
      try {
        await deleteStoredRefreshToken();
      } catch (deleteError) {
        logCredentialError("delete failed token", deleteError);
      }
    }
    return null;
  }
}

export async function persistAuthStateChange(
  event: AuthChangeEvent,
  session: Session | null,
): Promise<void> {
  try {
    if (
      (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") &&
      session?.refresh_token
    ) {
      await setStoredRefreshToken(session.refresh_token);
    } else if (event === "SIGNED_OUT") {
      await deleteStoredRefreshToken();
    }
  } catch (error) {
    logCredentialError(`auth event ${event}`, error);
  }
}
