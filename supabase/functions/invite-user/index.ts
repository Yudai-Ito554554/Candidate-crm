import { createClient } from "@supabase/supabase-js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const INVITE_REDIRECT_URL = "candidate-crm://auth/callback";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function parseInviteBody(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const displayName =
    typeof input.displayName === "string" ? input.displayName.trim() : "";
  const role = input.role;
  if (
    !EMAIL_PATTERN.test(email) ||
    email.length > 254 ||
    displayName.length > 100 ||
    (role !== "agent" && role !== "viewer")
  ) {
    return null;
  }
  return { email, displayName, role };
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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonResponse(400, { error: "リクエスト形式を確認してください。" });
    }
    const invite = parseInviteBody(rawBody);
    if (!invite) {
      return jsonResponse(400, { error: "招待内容を確認してください。" });
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

    const { data: callerProfile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();
    if (profileError || callerProfile?.role !== "admin") {
      return jsonResponse(403, {
        error: "ユーザーを招待できるのは管理者だけです。",
      });
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(invite.email, {
        redirectTo: INVITE_REDIRECT_URL,
        data: invite.displayName ? { display_name: invite.displayName } : {},
      });
    if (inviteError || !inviteData.user) {
      const duplicate = inviteError?.message
        .toLowerCase()
        .includes("already been registered");
      return jsonResponse(duplicate ? 409 : 400, {
        error: duplicate
          ? "このメールアドレスはすでに登録されています。"
          : "招待メールを送信できませんでした。時間を置いて再度お試しください。",
      });
    }

    const { error: roleError } = await adminClient.rpc(
      "apply_invited_profile_role",
      {
        target_user_id: inviteData.user.id,
        new_role: invite.role,
        requester_id: authData.user.id,
      },
    );
    if (roleError) {
      return jsonResponse(500, {
        error:
          "招待メールは送信されましたが、権限を設定できませんでした。チーム利用者から権限を設定してください。",
      });
    }

    return jsonResponse(200, { invited: true });
  } catch {
    return jsonResponse(500, {
      error: "ユーザー招待のサーバー設定を確認してください。",
    });
  }
});
