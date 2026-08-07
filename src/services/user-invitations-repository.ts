import { getSupabaseClient } from "@/lib/supabase";
import type { RepositoryResult } from "@/services/repository";

export interface UserInvitationInput {
  email: string;
  displayName: string;
  role: "agent" | "viewer";
}

interface FunctionErrorBody {
  error?: unknown;
}

async function readFunctionError(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) {
    return null;
  }
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const body = (await context.clone().json()) as FunctionErrorBody;
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

export async function inviteUser(
  input: UserInvitationInput,
): Promise<RepositoryResult<true>> {
  const client = await getSupabaseClient();
  if (!client) {
    return {
      data: null,
      error: {
        kind: "configuration",
        message: "Supabaseの接続設定を確認してください。",
      },
    };
  }

  try {
    const invocation: unknown = await client.functions.invoke("invite-user", {
      body: input,
    });
    if (!invocation || typeof invocation !== "object") {
      return {
        data: null,
        error: {
          kind: "unknown",
          message: "招待処理の結果を確認できませんでした。",
        },
      };
    }
    const data = "data" in invocation ? invocation.data : null;
    const error = "error" in invocation ? invocation.error : null;
    if (error) {
      return {
        data: null,
        error: {
          kind: "unknown",
          message:
            (await readFunctionError(error)) ??
            "招待メールを送信できませんでした。時間を置いて再度お試しください。",
        },
      };
    }
    if (
      !data ||
      typeof data !== "object" ||
      !("invited" in data) ||
      data.invited !== true
    ) {
      return {
        data: null,
        error: {
          kind: "unknown",
          message: "招待処理の結果を確認できませんでした。",
        },
      };
    }
    return { data: true, error: null };
  } catch {
    return {
      data: null,
      error: {
        kind: "unknown",
        message:
          "招待メールを送信できませんでした。ネットワーク接続を確認してください。",
      },
    };
  }
}
