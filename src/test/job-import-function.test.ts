import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const functionSource = readFileSync(
  resolve(process.cwd(), "supabase/functions/extract-job-posting/index.ts"),
  "utf8",
).toLowerCase();
const supabaseConfig = readFileSync(
  resolve(process.cwd(), "supabase/config.toml"),
  "utf8",
).toLowerCase();
const supabaseOperationsGuide = readFileSync(
  resolve(process.cwd(), "supabase/README.md"),
  "utf8",
);

describe("job posting extraction Edge Function", () => {
  it("keeps the provider credential server-side and requires an authenticated editor", () => {
    expect(functionSource).toContain('requiredsecret("openai_api_key")');
    expect(functionSource).toContain(
      'requiredsecret("supabase_service_role_key")',
    );
    expect(functionSource).toContain("auth.getuser(token)");
    expect(functionSource).toContain('profile.role !== "admin"');
    expect(functionSource).toContain('profile.role !== "agent"');
    expect(functionSource).not.toContain("vite_openai");
    expect(functionSource).not.toContain("vite_supabase_service_role");
    expect(supabaseConfig).toContain("[functions.extract-job-posting]");
    expect(supabaseConfig).toContain("verify_jwt = true");
  });

  it("uses strict Responses output and disables provider storage", () => {
    expect(functionSource).toContain(
      'fetch("https://api.openai.com/v1/responses"',
    );
    expect(functionSource).toContain('const openai_model = "gpt-5.6-luna"');
    expect(functionSource).toContain("store: false");
    expect(functionSource).toContain('type: "json_schema"');
    expect(functionSource).toContain("additionalproperties: false");
    expect(functionSource).toContain('detail: "low"');
    expect(functionSource).toContain("response.usage?.input_tokens");
    expect(functionSource).toContain("response.usage?.output_tokens");
    expect(functionSource).toContain("input_tokens: usage.inputtokens");
    expect(functionSource).toContain("output_tokens: usage.outputtokens");
    expect(functionSource).toContain(
      "providermodel = extractprovidermodel(providerbody, openai_model)",
    );
    expect(functionSource).toContain("provider_model: providermodel");
  });

  it("documents the reviewed server-side model without a model secret override", () => {
    expect(supabaseOperationsGuide).not.toMatch(
      /supabase secrets set[^\n]*OPENAI_MODEL/,
    );
    expect(supabaseOperationsGuide).toContain(
      "npx supabase functions deploy extract-job-posting",
    );
    expect(supabaseOperationsGuide).toContain(
      "レビュー済みモデルIDは各Edge Functionのサーバー側コードで固定",
    );
  });

  it("extracts company metadata only when the source explicitly states it", () => {
    expect(functionSource).toContain("company_industry");
    expect(functionSource).toContain("company_website");
    expect(functionSource).toContain(
      "企業の業種とwebサイトは求人票に明記されている場合だけ取得し、推測しないでください。",
    );
    expect(functionSource).toContain(
      "http://またはhttps://で始まる完全なurlだけを取得し、それ以外はnull",
    );
  });

  it("returns short source quotations for human review without persisting them", () => {
    expect(functionSource).toContain("job_extraction_fields");
    expect(functionSource).toContain("evidence");
    expect(functionSource).toContain("maxLength: 160".toLowerCase());
    expect(functionSource).toContain(
      "根拠となる求人票内の原文を160文字以内でevidenceへ記載してください。",
    );
    expect(functionSource).toContain(
      "根拠が見つからない項目のevidenceは作成しないでください。",
    );
  });

  it("limits source size and does not persist the source document", () => {
    expect(functionSource).toContain("max_text_length");
    expect(functionSource).toContain("max_pdf_bytes");
    expect(functionSource).not.toContain(".storage");
    expect(functionSource).not.toContain('.from("jobs")');
    expect(functionSource).not.toContain(".insert(");
  });

  it("validates uploaded and remote PDF signatures before provider submission", () => {
    expect(functionSource).toContain("function haspdfsignature");
    expect(functionSource).toContain("function haspdfeofmarker");
    expect(functionSource).toContain("function haspdfencryptiondictionary");
    expect(functionSource).toContain("function ispdfdocument");
    expect(functionSource).toContain('=== "%pdf-"');
    expect(functionSource).toContain('.includes("%%eof")');
    expect(functionSource).toContain("if (!ispdfdocument(filebytes))");
    expect(functionSource).toContain(
      'contenttype === "application/pdf" || haspdfheader',
    );
    expect(functionSource).toContain('new error("remote_invalid_pdf")');
    expect(functionSource).toContain('new error("remote_encrypted_pdf")');
    expect(functionSource).toContain(
      "pdfが壊れているか、読み込みが完了していません。別のpdfを選択してください。",
    );
    expect(functionSource).toContain(
      "パスワード保護されたpdfは読み込めません。保護を解除したpdfを選択してください。",
    );
  });

  it("claims an atomic server-side quota and finalizes usage metadata", () => {
    expect(functionSource).toContain('.rpc("claim_job_import_request"');
    expect(functionSource).toContain('.from("job_import_requests")');
    expect(functionSource).toMatch(
      /finishjobimportrequest\([\s\S]*?"completed"[\s\S]*?finishjobimportrequest\([\s\S]*?"failed"/,
    );
    expect(functionSource).toContain("job_import_already_running");
    expect(functionSource).toContain("job_import_hourly_limit");
    expect(functionSource).toContain("job_import_daily_limit");
    expect(functionSource).toContain("ai_already_running");
    expect(functionSource).toContain("ai_hourly_limit");
    expect(functionSource).toContain("ai_daily_limit");
    expect(functionSource).toContain("1時間のai求人取り込み上限（20回）");
    expect(functionSource).toContain("24時間のai求人取り込み上限（50回）");
  });

  it("fingerprints the exact provider request body before dispatch", () => {
    expect(functionSource).toContain(
      'requiredsecret("ai_fingerprint_hmac_key_v1")',
    );
    expect(functionSource).toContain(
      'const ai_provenance_version = "job-import/1"',
    );
    expect(functionSource).toContain(
      "const ai_fingerprint_hmac_key_version = 1",
    );
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
    expect(
      dispatchBody.indexOf("input_fingerprint: inputfingerprint"),
    ).toBeLessThan(dispatchBody.indexOf("body: providerrequestbody"));
  });

  it("protects URL imports from SSRF, redirect abuse, and oversized responses", () => {
    expect(functionSource).toContain('url.protocol !== "https:"');
    expect(functionSource).toContain("deno.resolvedns");
    expect(functionSource).toContain("ispublicipaddress");
    expect(functionSource).toContain('redirect: "manual"');
    expect(functionSource).toContain("max_redirects");
    expect(functionSource).toContain("max_web_page_bytes");
    expect(functionSource).toContain("readlimitedbody");
    expect(functionSource).toContain("remote_fetch_timeout_ms");
    expect(functionSource).not.toContain('redirect: "follow"');
  });
});
