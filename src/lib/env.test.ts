import { describe, expect, it } from "vitest";

import { validateEnvironment } from "@/lib/env";

describe("validateEnvironment", () => {
  it("環境変数不足を日本語で返す", () => {
    const result = validateEnvironment({
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.messages).toContain("Supabase URLが設定されていません。");
    expect(result.messages).toContain(
      "Supabase Publishable Keyが設定されていません。",
    );
  });

  it("有効な値を検証済みデータとして返す", () => {
    const result = validateEnvironment({
      VITE_SUPABASE_URL: "https://example.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
    });

    expect(result.success).toBe(true);
  });
});
