import {
  aiUsageSnapshotSchema,
  type AiUsageSnapshot,
} from "@/features/settings/ai-usage-model";
import { getSupabaseClient } from "@/lib/supabase";
import type { RepositoryResult } from "@/services/repository";

interface FunctionErrorBody {
  error?: unknown;
}

async function getFunctionErrorMessage(error: unknown) {
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

export async function getAiUsageSnapshot(): Promise<
  RepositoryResult<AiUsageSnapshot>
> {
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
    const invocation: unknown = await client.functions.invoke("get-ai-usage", {
      body: {},
    });
    if (!invocation || typeof invocation !== "object") {
      throw new Error("invalid_function_response");
    }
    const error = "error" in invocation ? invocation.error : null;
    if (error) {
      return {
        data: null,
        error: {
          kind: "unknown",
          message:
            (await getFunctionErrorMessage(error)) ??
            "AI利用状況を取得できませんでした。",
        },
      };
    }
    const parsed = aiUsageSnapshotSchema.safeParse(
      "data" in invocation ? invocation.data : null,
    );
    if (!parsed.success) throw new Error("invalid_function_response");
    return { data: parsed.data, error: null };
  } catch {
    return {
      data: null,
      error: {
        kind: "unknown",
        message:
          "AI利用状況を取得できませんでした。ネットワーク接続を確認してください。",
      },
    };
  }
}
