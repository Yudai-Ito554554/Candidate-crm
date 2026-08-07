import {
  jobImportResultSchema,
  type JobImportResult,
  type JobImportSource,
} from "@/features/applications/job-import-model";
import { getSupabaseClient } from "@/lib/supabase";
import type { RepositoryResult } from "@/services/repository";

interface FunctionErrorBody {
  error?: unknown;
}

async function getFunctionErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const body = (await context.clone().json()) as FunctionErrorBody;
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

function createRequestBody(source: JobImportSource): FormData {
  const body = new FormData();
  body.set("sourceType", source.type);
  if (source.type === "text") body.set("text", source.text.trim());
  else if (source.type === "pdf")
    body.set("file", source.file, source.file.name);
  else body.set("url", source.url.trim());
  return body;
}

export async function extractJobPosting(
  source: JobImportSource,
): Promise<RepositoryResult<JobImportResult>> {
  const client = await getSupabaseClient();
  if (!client)
    return {
      data: null,
      error: {
        kind: "configuration",
        message: "Supabaseの接続設定を確認してください。",
      },
    };

  try {
    const invocation: unknown = await client.functions.invoke(
      "extract-job-posting",
      { body: createRequestBody(source) },
    );
    if (!invocation || typeof invocation !== "object")
      throw new Error("invalid_function_response");

    const error = "error" in invocation ? invocation.error : null;
    if (error)
      return {
        data: null,
        error: {
          kind: "unknown",
          message:
            (await getFunctionErrorMessage(error)) ??
            "求人情報を読み取れませんでした。時間を置いて再度お試しください。",
        },
      };

    const parsed = jobImportResultSchema.safeParse(
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
          "求人情報を読み取れませんでした。ネットワーク接続を確認してください。",
      },
    };
  }
}
