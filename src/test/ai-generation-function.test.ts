import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const functionSource = readFileSync(
  resolve(
    process.cwd(),
    "supabase/functions/generate-candidate-summary/index.ts",
  ),
  "utf8",
).toLowerCase();
const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806082428_ai_generation_requests.sql",
  ),
  "utf8",
).toLowerCase();
const supabaseConfig = readFileSync(
  resolve(process.cwd(), "supabase/config.toml"),
  "utf8",
).toLowerCase();
const functionDenoConfig = readFileSync(
  resolve(
    process.cwd(),
    "supabase/functions/generate-candidate-summary/deno.json",
  ),
  "utf8",
).toLowerCase();

describe("candidate AI generation Edge Function", () => {
  it("keeps provider credentials server-side and requires an authenticated editor", () => {
    expect(functionSource).toContain('requiredsecret("openai_api_key")');
    expect(functionSource).toContain('const openai_model = "gpt-5.6-luna"');
    expect(functionSource).toContain("userclient.auth.getuser(token)");
    expect(functionSource).toContain('profile.role !== "admin"');
    expect(functionSource).toContain('profile.role !== "agent"');
    expect(functionSource).not.toContain("vite_openai");
    expect(functionSource).not.toContain("service_role_key:");
    expect(supabaseConfig).toContain("[functions.generate-candidate-summary]");
    expect(supabaseConfig).toContain("verify_jwt = true");
    expect(functionDenoConfig).toContain(
      '"@supabase/supabase-js": "npm:@supabase/supabase-js@2.112.0"',
    );
  });

  it("uses Responses structured output without provider-side response storage", () => {
    expect(functionSource).toContain(
      'fetch("https://api.openai.com/v1/responses"',
    );
    expect(functionSource).toContain("store: false");
    expect(functionSource).toContain('type: "json_schema"');
    expect(functionSource).toContain("additionalproperties: false");
    expect(functionSource).toContain("provider_timeout_ms");
    expect(functionSource).toContain(
      'const prompt_version = "candidate-summary-v2"',
    );
    const schemaBody = functionSource.slice(
      functionSource.indexOf("function summaryschema"),
      functionSource.indexOf("function extractoutputtext"),
    );
    expect(schemaBody).not.toContain("email_draft");
    expect(functionSource).toContain("response.usage?.input_tokens");
    expect(functionSource).toContain("response.usage?.output_tokens");
    expect(functionSource).toContain("input_tokens: providerusage.inputtokens");
    expect(functionSource).toContain(
      "output_tokens: providerusage.outputtokens",
    );
    expect(functionSource).toContain(
      "providermodel = extractprovidermodel(providerbody, openaimodel)",
    );
    expect(functionSource).toContain("provider_model: providermodel");
  });

  it("excludes direct identifiers and private notes from the AI context", () => {
    const redactBody = functionSource.slice(
      functionSource.indexOf("function redactcandidate"),
      functionSource.indexOf("function summaryschema"),
    );
    expect(redactBody).not.toContain("full_name:");
    expect(redactBody).not.toContain("email:");
    expect(redactBody).not.toContain("phone:");
    expect(redactBody).not.toContain("birth_date:");
    expect(redactBody).not.toContain("private_notes:");
    expect(functionSource).toContain('replaceall(candidatename, "[候補者]")');
    expect(functionSource).toContain("[メールアドレス]");
    expect(functionSource).toContain("[電話番号]");
  });

  it("fingerprints the exact provider request body before dispatch", () => {
    expect(functionSource).toContain(
      'requiredsecret("ai_fingerprint_hmac_key_v1")',
    );
    expect(functionSource).toContain(
      'const ai_provenance_version = "candidate-summary/1"',
    );
    expect(functionSource).toContain(
      "const ai_fingerprint_hmac_key_version = 1",
    );
    // The serialized string is both hashed and sent; a second
    // JSON.stringify of the body would break that guarantee.
    expect(functionSource).toContain("body: providerrequestbody");
    const dispatchBody = functionSource.slice(
      functionSource.indexOf("const providerrequestbody"),
      functionSource.indexOf("if (!providerresponse.ok)"),
    );
    expect(dispatchBody).toContain("computehmacsha256fingerprint(");
    expect(dispatchBody).toContain('hash_algorithm: "hmac-sha256"');
    expect(dispatchBody).toContain("input_fingerprint: inputfingerprint");
    expect(dispatchBody).toContain(
      'if (provenanceerror) throw new error("provenance_record_failed")',
    );
    // Provenance is written before the provider call, not after.
    expect(
      dispatchBody.indexOf("input_fingerprint: inputfingerprint"),
    ).toBeLessThan(dispatchBody.indexOf("body: providerrequestbody"));
  });

  it("guards concurrent requests and archives older summaries server-side", () => {
    expect(migration).toContain("create table public.ai_generation_requests");
    expect(migration).toContain(
      "create unique index ai_generation_requests_active_candidate_idx",
    );
    expect(migration).toContain(
      "revoke all on table public.ai_generation_requests from authenticated",
    );
    expect(migration).not.toMatch(/prompt text|response text|payload jsonb/);
    expect(functionSource).toContain('.rpc("claim_candidate_ai_request"');
    expect(functionSource).toContain("ai_candidate_cooldown");
    expect(functionSource).toContain("ai_already_running");
    expect(functionSource).toContain("ai_hourly_limit");
    expect(functionSource).toContain("ai_daily_limit");
    expect(functionSource).toContain("1時間のai利用上限（20回）");
    expect(functionSource).toContain("24時間のai利用上限（50回）");
    expect(functionSource).not.toContain(".insert({");
    expect(functionSource).toContain('.rpc("store_candidate_ai_summary"');
    expect(migration).toContain(
      "create or replace function public.store_candidate_ai_summary",
    );
    expect(migration).toContain("and id <> stored_summary.id");
    expect(migration).toContain("and archived_at is null");
    expect(migration).toContain("to service_role");
  });
});
