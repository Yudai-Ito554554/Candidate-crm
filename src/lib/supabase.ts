import type { SupabaseClient } from "@supabase/supabase-js";

import { environment } from "@/lib/env";

let clientPromise: Promise<SupabaseClient> | null = null;

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!environment.success) return null;

  const config = environment.data;
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(
      config.VITE_SUPABASE_URL,
      config.VITE_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: false,
          persistSession: true,
        },
      },
    ),
  );

  return clientPromise;
}
