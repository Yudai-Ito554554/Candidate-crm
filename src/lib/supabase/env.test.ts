import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Supabase environment", () => {
  it("両方の値が揃うと設定済みになる", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_example");

    const environment = await import("@/lib/supabase/env");

    expect(environment.isSupabaseConfigured).toBe(true);
    expect(environment.supabaseConfig).toEqual({
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
    });
  });

  it("片方だけ設定した場合は問題を通知する", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");

    const environment = await import("@/lib/supabase/env");

    expect(environment.isSupabaseConfigured).toBe(false);
    expect(environment.supabaseConfigurationIssue).toContain("環境変数");
  });
});
