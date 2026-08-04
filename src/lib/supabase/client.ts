import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

let clientPromise: Promise<SupabaseClient<Database>> | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient<Database> | null> {
  const config = supabaseConfig;
  if (!config) return null;

  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient<Database>(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
      },
    }),
  );

  return clientPromise;
}

export async function requireSupabaseClient(): Promise<
  SupabaseClient<Database>
> {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabaseが設定されていません。.envに接続情報を設定してください。",
    );
  }

  return client;
}
