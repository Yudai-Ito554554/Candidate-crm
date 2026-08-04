import { z } from "zod";

const supabaseEnvironmentSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(1),
});

const rawEnvironment = {
  url: import.meta.env.VITE_SUPABASE_URL?.trim() ?? "",
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "",
};

const hasAnySupabaseValue = Object.values(rawEnvironment).some(Boolean);
const parsedEnvironment = supabaseEnvironmentSchema.safeParse(rawEnvironment);

export const supabaseConfig = parsedEnvironment.success
  ? parsedEnvironment.data
  : null;

export const supabaseConfigurationIssue =
  hasAnySupabaseValue && !parsedEnvironment.success
    ? "Supabaseの環境変数が不足しているか、URLの形式が正しくありません。"
    : null;

export const isSupabaseConfigured = supabaseConfig !== null;
