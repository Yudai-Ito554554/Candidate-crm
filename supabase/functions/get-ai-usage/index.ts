import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HOURLY_LIMIT = 20;
const DAILY_LIMIT = 50;

type Feature = "candidate_summary" | "job_import";

interface UsageRow {
  requested_by: string;
  feature: Feature;
  provider_model: string | null;
  last_hour_count: number;
  last_day_count: number;
  completed_count: number;
  failed_count: number;
  running_count: number;
  input_token_count: number;
  output_token_count: number;
  next_hourly_recovery_at: string | null;
  next_daily_recovery_at: string | null;
}

interface UsageCounts {
  lastHour: number;
  last24Hours: number;
  completed: number;
  failed: number;
  running: number;
  inputTokens: number;
  outputTokens: number;
}

interface UserUsageCounts extends UsageCounts {
  nextHourlyRecoveryAt: string | null;
  nextDailyRecoveryAt: string | null;
}

interface EdgeDatabase {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: {
      get_ai_usage_snapshot: {
        Args: Record<string, never>;
        Returns: UsageRow[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function requiredSecret(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

function emptyCounts(): UsageCounts {
  return {
    lastHour: 0,
    last24Hours: 0,
    completed: 0,
    failed: 0,
    running: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
}

function addRow(target: UsageCounts, row: UsageRow) {
  target.lastHour += row.last_hour_count;
  target.last24Hours += row.last_day_count;
  target.completed += row.completed_count;
  target.failed += row.failed_count;
  target.running += row.running_count;
  target.inputTokens += row.input_token_count;
  target.outputTokens += row.output_token_count;
}

function earlierTimestamp(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;
  return candidate < current ? candidate : current;
}

function emptyUserCounts(): UserUsageCounts {
  return {
    ...emptyCounts(),
    nextHourlyRecoveryAt: null,
    nextDailyRecoveryAt: null,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "POSTメソッドを使用してください。" });
  }

  try {
    const supabaseUrl = requiredSecret("SUPABASE_URL");
    const publishableKey =
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
      requiredSecret("SUPABASE_ANON_KEY");
    const secretKey =
      Deno.env.get("SUPABASE_SECRET_KEY")?.trim() ||
      requiredSecret("SUPABASE_SERVICE_ROLE_KEY");
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(401, { error: "認証情報を確認してください。" });
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const token = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } =
      await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse(401, { error: "セッションが無効です。" });
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    const profileRole: unknown = profile?.role;
    if (
      profileError ||
      !profile ||
      typeof profileRole !== "string" ||
      !["admin", "agent"].includes(profileRole)
    ) {
      return jsonResponse(403, {
        error: "AI利用状況を確認する権限がありません。",
      });
    }

    const serviceClient = createClient<EdgeDatabase>(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data: usageRows, error: usageError } = await serviceClient.rpc(
      "get_ai_usage_snapshot",
      {},
    );
    if (usageError || !usageRows) throw new Error("usage_query_failed");

    const visibleUsageRows =
      profileRole === "admin"
        ? usageRows
        : usageRows.filter((row) => row.requested_by === authData.user.id);
    const totals = emptyCounts();
    const byFeature: Record<Feature, UsageCounts> = {
      candidate_summary: emptyCounts(),
      job_import: emptyCounts(),
    };
    const userCounts = new Map<string, UserUsageCounts>();
    const modelCounts = new Map<string, UsageCounts>();

    for (const row of visibleUsageRows) {
      addRow(totals, row);
      addRow(byFeature[row.feature], row);
      const modelName = row.provider_model ?? "不明（記録開始前）";
      const modelUsage = modelCounts.get(modelName) ?? emptyCounts();
      addRow(modelUsage, row);
      modelCounts.set(modelName, modelUsage);
      const counts = userCounts.get(row.requested_by) ?? emptyUserCounts();
      addRow(counts, row);
      counts.nextHourlyRecoveryAt = earlierTimestamp(
        counts.nextHourlyRecoveryAt,
        row.next_hourly_recovery_at,
      );
      counts.nextDailyRecoveryAt = earlierTimestamp(
        counts.nextDailyRecoveryAt,
        row.next_daily_recovery_at,
      );
      userCounts.set(row.requested_by, counts);
    }

    return jsonResponse(200, {
      generatedAt: new Date().toISOString(),
      limits: { hourly: HOURLY_LIMIT, daily: DAILY_LIMIT },
      totals,
      byFeature,
      byModel: [...modelCounts.entries()]
        .map(([model, counts]) => ({ model, ...counts }))
        .sort(
          (left, right) =>
            right.inputTokens +
              right.outputTokens -
              (left.inputTokens + left.outputTokens) ||
            right.last24Hours - left.last24Hours,
        ),
      byUser: [...userCounts.entries()]
        .map(([userId, counts]) => ({ userId, ...counts }))
        .sort((left, right) => right.last24Hours - left.last24Hours),
    });
  } catch {
    return jsonResponse(500, {
      error:
        "AI利用状況を取得できませんでした。時間を置いて再度お試しください。",
    });
  }
});
