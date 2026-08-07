import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const functionSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/get-ai-usage/index.ts"),
  "utf8",
).toLowerCase();
const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260806222635_ai_usage_snapshot.sql",
  ),
  "utf8",
).toLowerCase();
const config = readFileSync(
  resolve(process.cwd(), "supabase/config.toml"),
  "utf8",
).toLowerCase();

describe("AI usage Edge Function", () => {
  it("requires an authenticated editor and keeps elevated credentials server-side", () => {
    expect(functionSource).toContain("auth.getuser(token)");
    expect(functionSource).toContain(
      '["admin", "agent"].includes(profilerole)',
    );
    expect(functionSource).toContain(
      'requiredsecret("supabase_service_role_key")',
    );
    expect(functionSource).not.toContain("vite_supabase_service_role");
    expect(config).toContain("[functions.get-ai-usage]");
    expect(config).toContain("verify_jwt = true");
  });

  it("returns team counts to admins and only self counts to agents", () => {
    expect(functionSource).toContain('profilerole === "admin"');
    expect(functionSource).toContain("row.requested_by === authdata.user.id");
    expect(functionSource).toContain("for (const row of visibleusagerows)");
    expect(functionSource).toContain("nexthourlyrecoveryat");
    expect(functionSource).toContain("nextdailyrecoveryat");
    expect(functionSource).toContain("inputtokens += row.input_token_count");
    expect(functionSource).toContain("outputtokens += row.output_token_count");
    expect(functionSource).toContain("row.provider_model");
    expect(functionSource).toContain("bymodel:");
  });

  it("returns database aggregates without reading business content", () => {
    expect(functionSource).toContain("serviceclient.rpc");
    expect(functionSource).toContain('"get_ai_usage_snapshot"');
    expect(functionSource).not.toContain('.from("candidates")');
    expect(functionSource).not.toContain('.from("ai_generation_requests")');
    expect(functionSource).not.toContain('.from("job_import_requests")');
    expect(functionSource).not.toContain("console.log");
  });

  it("keeps the aggregate RPC service-only and count-only", () => {
    expect(migration).toContain(
      "create or replace function public.get_ai_usage_snapshot",
    );
    expect(migration).toContain(
      "revoke all on function public.get_ai_usage_snapshot() from authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.get_ai_usage_snapshot() to service_role",
    );
    expect(migration).toContain("count(*) filter");
    expect(migration).not.toMatch(
      /\b(candidate_id|prompt_text|provider_output|source_text)\b/,
    );
  });
});
