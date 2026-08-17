import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// The two Edge Functions run under Deno. They are imported dynamically by
// file URL so the app TypeScript project does not typecheck Deno globals,
// while Vitest still executes the real handler and can assert on the order
// and count of provider and database calls.

interface RecordedCall {
  kind: "db" | "rpc" | "fetch";
  table?: string;
  op?: string;
  rpcName?: string;
  payload?: Record<string, unknown>;
}

interface QueryOutcome {
  data: unknown;
  error: unknown;
}

type OutcomeResolver = (call: {
  table: string;
  op: string;
  payload?: Record<string, unknown>;
}) => QueryOutcome;

function createQueryBuilder(
  table: string,
  calls: RecordedCall[],
  resolveOutcome: OutcomeResolver,
) {
  let op = "select";
  let payload: Record<string, unknown> | undefined;
  let recorded = false;

  const record = () => {
    if (recorded) return;
    recorded = true;
    calls.push({ kind: "db", table, op, payload });
  };

  const settle = () => {
    record();
    return resolveOutcome({ table, op, payload });
  };

  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    in: () => builder,
    order: () => builder,
    limit: () => builder,
    update: (values: Record<string, unknown>) => {
      op = "update";
      payload = values;
      return builder;
    },
    insert: (values: Record<string, unknown>) => {
      op = "insert";
      payload = values;
      return builder;
    },
    single: () => Promise.resolve(settle()),
    then: (
      onFulfilled: (value: QueryOutcome) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(settle()).then(onFulfilled, onRejected),
  };

  return builder;
}

function createFakeSupabase(
  calls: RecordedCall[],
  resolveOutcome: OutcomeResolver,
  resolveRpc: (name: string) => QueryOutcome,
) {
  return {
    auth: {
      getUser: () =>
        Promise.resolve({
          data: {
            user: { id: "00000000-0000-4000-8000-000000000001" },
          },
          error: null,
        }),
    },
    from: (table: string) => createQueryBuilder(table, calls, resolveOutcome),
    rpc: (name: string) => {
      calls.push({ kind: "rpc", rpcName: name });
      const outcome = resolveRpc(name);
      const thenable: Record<string, unknown> = {
        single: () => Promise.resolve(outcome),
        then: (
          onFulfilled: (value: QueryOutcome) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(outcome).then(onFulfilled, onRejected),
      };
      return thenable;
    },
  };
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => activeSupabaseClient,
}));

let activeSupabaseClient: unknown = null;

const CANDIDATE_ID = "00000000-0000-4000-8000-00000000000c";
const SECRETS: Record<string, string> = {
  SUPABASE_URL: "https://example.invalid",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  OPENAI_API_KEY: "openai-key",
  AI_FINGERPRINT_HMAC_KEY_V1: "test-hmac-key-value",
};

function installDeno(secrets: Record<string, string | undefined>) {
  let captured: ((request: Request) => Promise<Response>) | null = null;
  (globalThis as Record<string, unknown>).Deno = {
    env: { get: (name: string) => secrets[name] },
    serve: (handler: (request: Request) => Promise<Response>) => {
      captured = handler;
    },
    resolveDns: () => Promise.resolve([]),
  };
  return () => captured;
}

function providerSuccessResponse(outputText: string) {
  return new Response(
    JSON.stringify({
      model: "gpt-5.6-luna",
      usage: { input_tokens: 10, output_tokens: 20 },
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: outputText }],
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const CANDIDATE_SUMMARY_OUTPUT = JSON.stringify({
  candidate_summary: "summary",
  change_reason_summary: "reason",
  strengths: "strengths",
  concerns: "concerns",
  interview_questions: "questions",
  recommended_jobs: "jobs",
  next_action: "next",
});

async function loadCandidateSummaryHandler(
  secrets: Record<string, string | undefined>,
) {
  const getHandler = installDeno(secrets);
  vi.resetModules();
  const url = pathToFileURL(
    resolve(
      process.cwd(),
      "supabase/functions/generate-candidate-summary/index.ts",
    ),
  ).href;
  await import(/* @vite-ignore */ url);
  const handler = getHandler();
  if (!handler) throw new Error("handler was not registered");
  return handler;
}

function candidateSummaryRequest() {
  return new Request("https://edge.invalid/generate-candidate-summary", {
    method: "POST",
    headers: {
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ candidateId: CANDIDATE_ID }),
  });
}

function defaultCandidateOutcome(call: {
  table: string;
  op: string;
}): QueryOutcome {
  if (call.table === "profiles")
    return { data: { role: "admin" }, error: null };
  if (call.table === "candidates") {
    return {
      data: {
        id: CANDIDATE_ID,
        full_name: "架空 太郎",
        candidate_status: "new",
        desired_occupations: [],
        desired_locations: [],
        waiting_on: "agent",
      },
      error: null,
    };
  }
  if (call.table === "ai_generation_requests")
    return { data: null, error: null };
  return { data: [], error: null };
}

describe("candidate summary provenance dispatch", () => {
  beforeEach(() => {
    activeSupabaseClient = null;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records provenance immediately before the provider is called", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      defaultCandidateOutcome,
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );

    const providerFetch = vi.fn(() => {
      calls.push({ kind: "fetch" });
      return Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT));
    });
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadCandidateSummaryHandler(SECRETS);
    const response = await handler(candidateSummaryRequest());

    expect(response.status).toBe(200);
    expect(providerFetch).toHaveBeenCalledTimes(1);

    const provenanceIndex = calls.findIndex(
      (call) =>
        call.kind === "db" &&
        call.table === "ai_generation_requests" &&
        call.op === "update" &&
        call.payload?.input_fingerprint !== undefined,
    );
    const fetchIndex = calls.findIndex((call) => call.kind === "fetch");

    expect(provenanceIndex).toBeGreaterThanOrEqual(0);
    expect(fetchIndex).toBeGreaterThanOrEqual(0);
    expect(provenanceIndex).toBeLessThan(fetchIndex);
    // Nothing else touches the request row between recording and dispatch.
    expect(fetchIndex - provenanceIndex).toBe(1);
  });

  it("writes all five provenance columns in the expected format", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      defaultCandidateOutcome,
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );
    vi.stubGlobal("fetch", () =>
      Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT)),
    );

    const handler = await loadCandidateSummaryHandler(SECRETS);
    await handler(candidateSummaryRequest());

    const provenance = calls.find(
      (call) => call.payload?.input_fingerprint !== undefined,
    )?.payload;

    expect(provenance).toMatchObject({
      hash_algorithm: "hmac-sha256",
      hash_key_version: 1,
      redaction_version: "candidate-summary/1",
      input_schema_version: "candidate-summary/1",
    });
    expect(provenance?.input_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the same fingerprint for the same input across runs", async () => {
    const runFingerprint = async () => {
      const calls: RecordedCall[] = [];
      activeSupabaseClient = createFakeSupabase(
        calls,
        defaultCandidateOutcome,
        (name) =>
          name === "claim_candidate_ai_request"
            ? { data: "request-id-1", error: null }
            : { data: { id: "summary-id-1" }, error: null },
      );
      vi.stubGlobal("fetch", () =>
        Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT)),
      );
      const handler = await loadCandidateSummaryHandler(SECRETS);
      await handler(candidateSummaryRequest());
      return calls.find((call) => call.payload?.input_fingerprint !== undefined)
        ?.payload?.input_fingerprint;
    };

    const first = await runFingerprint();
    const second = await runFingerprint();

    expect(first).toBeDefined();
    expect(first).toBe(second);
  });

  it("hashes the exact string it sends as the request body", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      defaultCandidateOutcome,
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );
    let sentBody: string | null = null;
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) => {
      sentBody = init.body as string;
      return Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT));
    });

    const handler = await loadCandidateSummaryHandler(SECRETS);
    await handler(candidateSummaryRequest());

    const recordedFingerprint = calls.find(
      (call) => call.payload?.input_fingerprint !== undefined,
    )?.payload?.input_fingerprint;

    const { computeHmacSha256Fingerprint } =
      await import("../../supabase/functions/_shared/ai-provenance");
    expect(sentBody).not.toBeNull();
    const recomputed = await computeHmacSha256Fingerprint(
      sentBody as unknown as string,
      SECRETS.AI_FINGERPRINT_HMAC_KEY_V1,
    );
    expect(recomputed).toBe(recordedFingerprint);
  });

  it("does not call the provider when the HMAC key is missing", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      defaultCandidateOutcome,
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );
    const providerFetch = vi.fn(() =>
      Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT)),
    );
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadCandidateSummaryHandler({
      ...SECRETS,
      AI_FINGERPRINT_HMAC_KEY_V1: undefined,
    });
    const response = await handler(candidateSummaryRequest());

    expect(providerFetch).toHaveBeenCalledTimes(0);
    expect(response.status).toBe(500);
  });

  it("does not call the provider when the HMAC key is empty", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      defaultCandidateOutcome,
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );
    const providerFetch = vi.fn(() =>
      Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT)),
    );
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadCandidateSummaryHandler({
      ...SECRETS,
      AI_FINGERPRINT_HMAC_KEY_V1: "   ",
    });
    const response = await handler(candidateSummaryRequest());

    expect(providerFetch).toHaveBeenCalledTimes(0);
    expect(response.status).toBe(500);
  });

  it("does not call the provider when the provenance update fails", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      (call) => {
        if (
          call.table === "ai_generation_requests" &&
          call.op === "update" &&
          call.payload?.input_fingerprint !== undefined
        ) {
          return { data: null, error: { message: "update rejected" } };
        }
        return defaultCandidateOutcome(call);
      },
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );
    const providerFetch = vi.fn(() =>
      Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT)),
    );
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadCandidateSummaryHandler(SECRETS);
    const response = await handler(candidateSummaryRequest());

    expect(providerFetch).toHaveBeenCalledTimes(0);
    expect(response.status).toBe(500);
  });

  it("keeps the input, key, and fingerprint out of the error response", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      (call) => {
        if (
          call.table === "ai_generation_requests" &&
          call.op === "update" &&
          call.payload?.input_fingerprint !== undefined
        ) {
          return { data: null, error: { message: "update rejected" } };
        }
        return defaultCandidateOutcome(call);
      },
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );
    vi.stubGlobal("fetch", () =>
      Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT)),
    );

    const handler = await loadCandidateSummaryHandler(SECRETS);
    const response = await handler(candidateSummaryRequest());
    const responseText = await response.text();

    expect(responseText).not.toContain(SECRETS.AI_FINGERPRINT_HMAC_KEY_V1);
    expect(responseText).not.toContain("架空 太郎");
    expect(responseText).not.toMatch(/[0-9a-f]{64}/);
    expect(responseText).not.toContain("hmac");
  });

  // A cache hit is served entirely by the client-side result cache and never
  // reaches this function, so no request row and no provenance exist for it
  // (see job-import-panel.test.tsx "reuses one of the recent import results").
  // The server-side half of that guarantee is that provenance is written once
  // per dispatch and never without one.
  it("writes provenance exactly once per provider dispatch", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      defaultCandidateOutcome,
      (name) =>
        name === "claim_candidate_ai_request"
          ? { data: "request-id-1", error: null }
          : { data: { id: "summary-id-1" }, error: null },
    );
    const providerFetch = vi.fn(() =>
      Promise.resolve(providerSuccessResponse(CANDIDATE_SUMMARY_OUTPUT)),
    );
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadCandidateSummaryHandler(SECRETS);
    await handler(candidateSummaryRequest());

    const provenanceWrites = calls.filter(
      (call) => call.payload?.input_fingerprint !== undefined,
    );
    expect(provenanceWrites).toHaveLength(1);
    expect(providerFetch).toHaveBeenCalledTimes(1);
  });
});

describe("job import provenance dispatch", () => {
  const loadJobImportHandler = async (
    secrets: Record<string, string | undefined>,
  ) => {
    const getHandler = installDeno(secrets);
    vi.resetModules();
    const url = pathToFileURL(
      resolve(process.cwd(), "supabase/functions/extract-job-posting/index.ts"),
    ).href;
    await import(/* @vite-ignore */ url);
    const handler = getHandler();
    if (!handler) throw new Error("handler was not registered");
    return handler;
  };

  const jobImportRequest = () => {
    const form = new FormData();
    form.set("sourceType", "text");
    form.set(
      "text",
      "架空株式会社のバックエンドエンジニア求人です。勤務地は東京都、年収は600万円から900万円です。",
    );
    return new Request("https://edge.invalid/extract-job-posting", {
      method: "POST",
      headers: { Authorization: "Bearer test-token" },
      body: form,
    });
  };

  const JOB_EXTRACTION_OUTPUT = JSON.stringify({
    company_name: "架空株式会社",
    company_industry: null,
    company_website: null,
    title: "バックエンドエンジニア",
    division: null,
    occupation: null,
    employment_type: null,
    locations: ["東京都"],
    salary_min: 600,
    salary_max: 900,
    required_conditions: null,
    preferred_conditions: null,
    description: null,
    opened_at: null,
    closed_at: null,
    warnings: [],
    missing_fields: [],
    evidence: [],
  });

  const jobOutcome = (call: { table: string }): QueryOutcome => {
    if (call.table === "profiles")
      return { data: { role: "admin" }, error: null };
    return { data: null, error: null };
  };

  beforeEach(() => {
    activeSupabaseClient = null;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records provenance immediately before the provider is called", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(calls, jobOutcome, () => ({
      data: "import-request-id-1",
      error: null,
    }));
    const providerFetch = vi.fn(() => {
      calls.push({ kind: "fetch" });
      return Promise.resolve(providerSuccessResponse(JOB_EXTRACTION_OUTPUT));
    });
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadJobImportHandler(SECRETS);
    const response = await handler(jobImportRequest());

    expect(response.status).toBe(200);
    expect(providerFetch).toHaveBeenCalledTimes(1);

    const provenanceIndex = calls.findIndex(
      (call) =>
        call.kind === "db" &&
        call.table === "job_import_requests" &&
        call.op === "update" &&
        call.payload?.input_fingerprint !== undefined,
    );
    const fetchIndex = calls.findIndex((call) => call.kind === "fetch");

    expect(provenanceIndex).toBeGreaterThanOrEqual(0);
    expect(provenanceIndex).toBeLessThan(fetchIndex);
    expect(fetchIndex - provenanceIndex).toBe(1);
  });

  it("writes all five provenance columns with the job-import namespace", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(calls, jobOutcome, () => ({
      data: "import-request-id-1",
      error: null,
    }));
    vi.stubGlobal("fetch", () =>
      Promise.resolve(providerSuccessResponse(JOB_EXTRACTION_OUTPUT)),
    );

    const handler = await loadJobImportHandler(SECRETS);
    await handler(jobImportRequest());

    const provenance = calls.find(
      (call) => call.payload?.input_fingerprint !== undefined,
    )?.payload;

    expect(provenance).toMatchObject({
      hash_algorithm: "hmac-sha256",
      hash_key_version: 1,
      redaction_version: "job-import/1",
      input_schema_version: "job-import/1",
    });
    expect(provenance?.input_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("does not call the provider when the HMAC key is missing", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(calls, jobOutcome, () => ({
      data: "import-request-id-1",
      error: null,
    }));
    const providerFetch = vi.fn(() =>
      Promise.resolve(providerSuccessResponse(JOB_EXTRACTION_OUTPUT)),
    );
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadJobImportHandler({
      ...SECRETS,
      AI_FINGERPRINT_HMAC_KEY_V1: undefined,
    });
    const response = await handler(jobImportRequest());

    expect(providerFetch).toHaveBeenCalledTimes(0);
    expect(response.status).toBe(500);
  });

  it("does not call the provider when the provenance update fails", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      (call) => {
        if (
          call.table === "job_import_requests" &&
          call.op === "update" &&
          call.payload?.input_fingerprint !== undefined
        ) {
          return { data: null, error: { message: "update rejected" } };
        }
        return jobOutcome(call);
      },
      () => ({ data: "import-request-id-1", error: null }),
    );
    const providerFetch = vi.fn(() =>
      Promise.resolve(providerSuccessResponse(JOB_EXTRACTION_OUTPUT)),
    );
    vi.stubGlobal("fetch", providerFetch);

    const handler = await loadJobImportHandler(SECRETS);
    const response = await handler(jobImportRequest());

    expect(providerFetch).toHaveBeenCalledTimes(0);
    expect(response.status).toBe(500);
  });

  it("keeps the input, key, and fingerprint out of the error response", async () => {
    const calls: RecordedCall[] = [];
    activeSupabaseClient = createFakeSupabase(
      calls,
      (call) => {
        if (
          call.table === "job_import_requests" &&
          call.op === "update" &&
          call.payload?.input_fingerprint !== undefined
        ) {
          return { data: null, error: { message: "update rejected" } };
        }
        return jobOutcome(call);
      },
      () => ({ data: "import-request-id-1", error: null }),
    );
    vi.stubGlobal("fetch", () =>
      Promise.resolve(providerSuccessResponse(JOB_EXTRACTION_OUTPUT)),
    );

    const handler = await loadJobImportHandler(SECRETS);
    const response = await handler(jobImportRequest());
    const responseText = await response.text();

    expect(responseText).not.toContain(SECRETS.AI_FINGERPRINT_HMAC_KEY_V1);
    expect(responseText).not.toContain("架空株式会社");
    expect(responseText).not.toMatch(/[0-9a-f]{64}/);
    expect(responseText).not.toContain("hmac");
  });
});
