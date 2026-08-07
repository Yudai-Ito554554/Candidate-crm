import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseClient } from "@/lib/supabase";

export type RepositoryErrorKind =
  | "configuration"
  | "authentication"
  | "authorization"
  | "conflict"
  | "validation"
  | "unknown";

export interface RepositoryError {
  kind: RepositoryErrorKind;
  message: string;
  code?: string;
}

export type RepositoryResult<T> =
  { data: T; error: null } | { data: null; error: RepositoryError };

type PostgrestErrorLike = Pick<PostgrestError, "code" | "message">;

interface SelectResponse {
  data: unknown;
  error: PostgrestError | null;
}

interface SingleResponse {
  data: unknown;
  error: PostgrestError | null;
}

export function toRepositoryError(error: PostgrestErrorLike): RepositoryError {
  if (error.message === "tag is still in use") {
    return {
      kind: "conflict",
      message:
        "このタグは候補者・企業・求人で使用中です。関連付けを外してから再度お試しください。",
      code: error.code,
    };
  }
  if (error.code === "PGRST301") {
    return {
      kind: "authentication",
      message: "セッションが無効です。再度ログインしてください。",
      code: error.code,
    };
  }
  if (error.code === "42501") {
    return {
      kind: "authorization",
      message: "このデータを操作する権限がありません。",
      code: error.code,
    };
  }
  if (error.code === "23505") {
    return {
      kind: "conflict",
      message: "同じ内容のデータがすでに登録されています。",
      code: error.code,
    };
  }
  if (["23502", "23503", "23514", "22P02"].includes(error.code)) {
    return {
      kind: "validation",
      message: "入力内容または関連データを確認してください。",
      code: error.code,
    };
  }
  return {
    kind: "unknown",
    message: "データの取得に失敗しました。時間を置いて再度お試しください。",
    code: error.code,
  };
}

export async function executeSelect<T>(
  operation: (client: SupabaseClient) => PromiseLike<SelectResponse>,
): Promise<RepositoryResult<T[]>> {
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
    const { data, error } = await operation(client);
    if (error) return { data: null, error: toRepositoryError(error) };
    return { data: (data ?? []) as T[], error: null };
  } catch {
    return {
      data: null,
      error: {
        kind: "unknown",
        message:
          "データの取得に失敗しました。ネットワーク接続を確認してください。",
      },
    };
  }
}

export async function executePaginatedSelect<T>(
  operation: (
    client: SupabaseClient,
    from: number,
    to: number,
  ) => PromiseLike<SelectResponse>,
  pageSize = 500,
): Promise<RepositoryResult<T[]>> {
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
    const rows: T[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await operation(
        client,
        from,
        from + pageSize - 1,
      );
      if (error) return { data: null, error: toRepositoryError(error) };

      const page = (data ?? []) as T[];
      rows.push(...page);
      if (page.length < pageSize) return { data: rows, error: null };
    }
  } catch {
    return {
      data: null,
      error: {
        kind: "unknown",
        message:
          "データの取得に失敗しました。ネットワーク接続を確認してください。",
      },
    };
  }
}

export async function executeSingle<T>(
  operation: (client: SupabaseClient) => PromiseLike<SingleResponse>,
): Promise<RepositoryResult<T>> {
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
    const { data, error } = await operation(client);
    if (error) return { data: null, error: toRepositoryError(error) };
    if (data === null) {
      return {
        data: null,
        error: {
          kind: "unknown",
          message: "データを確認できませんでした。再度お試しください。",
        },
      };
    }
    return { data: data as T, error: null };
  } catch {
    return {
      data: null,
      error: {
        kind: "unknown",
        message:
          "データの保存に失敗しました。ネットワーク接続を確認してください。",
      },
    };
  }
}
