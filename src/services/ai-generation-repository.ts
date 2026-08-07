import { getSupabaseClient } from "@/lib/supabase";
import type { RepositoryResult } from "@/services/repository";

interface GenerateCandidateSummaryResult {
  summaryId: string;
}

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

export async function generateCandidateSummary(
  candidateId: string,
): Promise<RepositoryResult<GenerateCandidateSummaryResult>> {
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
    const invocation: unknown = await client.functions.invoke(
      "generate-candidate-summary",
      { body: { candidateId } },
    );
    if (!invocation || typeof invocation !== "object") {
      return {
        data: null,
        error: {
          kind: "unknown",
          message: "AIサマリーの生成結果を確認できませんでした。",
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
            (await getFunctionErrorMessage(error)) ??
            "AIサマリーを生成できませんでした。時間を置いて再度お試しください。",
        },
      };
    }
    if (
      !data ||
      typeof data !== "object" ||
      typeof (data as { summaryId?: unknown }).summaryId !== "string"
    ) {
      return {
        data: null,
        error: {
          kind: "unknown",
          message: "AIサマリーの生成結果を確認できませんでした。",
        },
      };
    }
    return {
      data: { summaryId: (data as { summaryId: string }).summaryId },
      error: null,
    };
  } catch {
    return {
      data: null,
      error: {
        kind: "unknown",
        message:
          "AIサマリーを生成できませんでした。ネットワーク接続を確認してください。",
      },
    };
  }
}
