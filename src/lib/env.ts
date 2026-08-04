import { z } from "zod";

const environmentSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .trim()
    .min(1, "Supabase URLが設定されていません。")
    .url("Supabase URLの形式が正しくありません。"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "Supabase Publishable Keyが設定されていません。"),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export type EnvironmentValidationResult =
  | { success: true; data: AppEnvironment }
  | { success: false; messages: string[] };

export function validateEnvironment(
  values: Record<string, unknown>,
): EnvironmentValidationResult {
  const result = environmentSchema.safeParse(values);
  if (result.success) return { success: true, data: result.data };

  return {
    success: false,
    messages: [...new Set(result.error.issues.map((issue) => issue.message))],
  };
}

export const environment = validateEnvironment({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});
