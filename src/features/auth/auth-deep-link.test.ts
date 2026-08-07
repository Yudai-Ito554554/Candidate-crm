import { parseAuthDeepLink } from "@/features/auth/auth-deep-link";

describe("auth deep link", () => {
  it("accepts Candidate CRM invite and recovery callbacks", () => {
    expect(
      parseAuthDeepLink(
        "candidate-crm://auth/callback#access_token=access&refresh_token=refresh&type=invite",
      ),
    ).toEqual({
      kind: "invite",
      tokens: { accessToken: "access", refreshToken: "refresh" },
    });
    expect(
      parseAuthDeepLink(
        "candidate-crm://malicious/callback#access_token=access&refresh_token=refresh&type=invite",
      ),
    ).toEqual({ kind: "ignored" });
    expect(
      parseAuthDeepLink(
        "candidate-crm://auth/callback#access_token=access&refresh_token=refresh&type=recovery",
      ),
    ).toEqual({
      kind: "recovery",
      tokens: { accessToken: "access", refreshToken: "refresh" },
    });
    expect(
      parseAuthDeepLink(
        "candidate-crm://auth/callback#access_token=access&refresh_token=refresh&type=magiclink",
      ),
    ).toEqual({ kind: "error", message: "対応していない認証リンクです。" });
  });

  it("does not expose provider error details", () => {
    const result = parseAuthDeepLink(
      "candidate-crm://auth/callback#error_description=sensitive-provider-detail&type=invite",
    );
    expect(result.kind).toBe("error");
    expect(JSON.stringify(result)).not.toContain("sensitive-provider-detail");
  });
});
