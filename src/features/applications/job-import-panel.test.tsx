import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { JobImportPanel } from "@/features/applications/job-import-panel";
import type { JobImportResult } from "@/features/applications/job-import-model";
import { toJobFormValues } from "@/features/applications/job-form-model";
import type { CompanyRow } from "@/types/database";

const { extractJobPostingMock, usageQueryMock } = vi.hoisted(() => ({
  extractJobPostingMock: vi.fn(),
  usageQueryMock: vi.fn(),
}));

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({ user: { id: "11111111-1111-4111-8111-111111111111" } }),
}));

vi.mock("@/features/access/use-access", () => ({
  useAccess: () => ({ canWrite: true }),
}));

vi.mock("@/features/settings/ai-usage-queries", () => ({
  aiUsageQueryKeys: { all: ["ai-usage"] },
  useAiUsageQuery: usageQueryMock,
}));

vi.mock("@/services/job-import-repository", () => ({
  extractJobPosting: extractJobPostingMock,
}));

const extracted: JobImportResult = {
  company_name: "メディカルデバイス株式会社",
  company_industry: "医療機器メーカー",
  company_website: "https://medical-device.example.jp",
  title: "循環器製品 営業担当",
  division: "循環器事業部",
  occupation: "医療機器営業",
  employment_type: "正社員",
  locations: ["東京都"],
  salary_min: 600,
  salary_max: 900,
  required_conditions: "医療業界での営業経験",
  preferred_conditions: null,
  description: "基幹病院への提案営業",
  opened_at: null,
  closed_at: null,
  warnings: [],
  missing_fields: ["歓迎条件"],
  evidence: [
    {
      field: "company_name",
      quote: "会社名：メディカルデバイス株式会社",
    },
    {
      field: "company_website",
      quote: "https://medical-device.example.jp",
    },
    { field: "title", quote: "募集職種：循環器製品 営業担当" },
    { field: "division", quote: "配属：循環器事業部" },
    { field: "occupation", quote: "職種：医療機器営業" },
    { field: "employment_type", quote: "雇用形態：正社員" },
    { field: "locations", quote: "勤務地：東京都" },
    { field: "salary_min", quote: "想定年収 600万円〜900万円" },
    { field: "salary_max", quote: "想定年収 600万円〜900万円" },
    {
      field: "required_conditions",
      quote: "必須条件：医療業界での営業経験",
    },
    { field: "description", quote: "基幹病院への提案営業" },
  ],
};

const matchedCompany = {
  id: "company-001",
  name: "メディカルデバイス株式会社",
  website: "https://medical-device.example.jp",
} as CompanyRow;

describe("JobImportPanel", () => {
  it("validates the source before enabling AI extraction", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const extractButton = screen.getByRole("button", { name: "AIで読み取る" });
    const sourceInput = screen.getByLabelText("求人票テキスト");
    expect(extractButton).toBeDisabled();
    await user.type(sourceInput, "短い文章");
    expect(screen.getByText("4 / 30,000文字")).toBeVisible();
    expect(
      screen.getByText("求人票の文章を20文字以上貼り付けてください。"),
    ).toBeVisible();
    expect(extractButton).toBeDisabled();
    await user.type(
      sourceInput,
      "ですが必要な長さまで入力を追加します。内容確認用です。",
    );
    expect(extractButton).toBeEnabled();
  });

  it("accepts a PDF by drag and drop and validates the dropped file", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "PDFを選択" }));
    const dropArea = screen.getByRole("group", {
      name: "求人票PDFのドロップ領域",
    });
    const pdf = new File(["%PDF-1.4 test"], "架空求人票.pdf", {
      type: "application/pdf",
    });

    fireEvent.dragEnter(dropArea, { dataTransfer: { files: [pdf] } });
    expect(dropArea).toHaveClass("border-blue-500");
    fireEvent.drop(dropArea, { dataTransfer: { files: [pdf] } });

    expect(screen.getByText(/選択中：架空求人票\.pdf/)).toBeVisible();
    expect(screen.getByRole("button", { name: "AIで読み取る" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "選択中のPDFを解除" }));
    expect(
      screen.queryByText(/選択中：架空求人票\.pdf/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AIで読み取る" })).toBeDisabled();

    const secondPdf = new File(["%PDF-1.4 second"], "別求人票.pdf", {
      type: "application/pdf",
    });
    fireEvent.drop(dropArea, {
      dataTransfer: { files: [pdf, secondPdf] },
    });
    expect(screen.getByText("PDFは1件ずつ選択してください。")).toBeVisible();
    expect(screen.queryByText(/選択中：/)).not.toBeInTheDocument();

    const invalidFile = new File(["not a pdf"], "求人票.txt", {
      type: "text/plain",
    });
    fireEvent.drop(dropArea, { dataTransfer: { files: [invalidFile] } });
    expect(screen.getByText("PDFファイルを選択してください。")).toBeVisible();
    expect(screen.getByRole("button", { name: "AIで読み取る" })).toBeDisabled();
  });

  it("identifies a PDF as the source of the displayed extraction result", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockResolvedValue({ data: extracted, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "PDFを選択" }));
    const pdf = new File(
      ["%PDF-1.4\n架空求人票のテスト本文\n%%EOF"],
      "架空求人票.pdf",
      { type: "application/pdf" },
    );
    await user.upload(screen.getByLabelText("求人票PDF（5MB以内）"), pdf);
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(
      await screen.findByLabelText("読み取り結果の入力元"),
    ).toHaveTextContent("入力元：PDF：架空求人票.pdf");
    expect(extractJobPostingMock).toHaveBeenCalledWith({
      type: "pdf",
      file: pdf,
    });
  });

  it("identifies the public host as the source of a URL extraction result", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockResolvedValue({ data: extracted, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "公開URLを入力" }));
    await user.type(
      screen.getByLabelText("公開求人ページURL"),
      "https://careers.example.co.jp/jobs/medical-sales",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(
      await screen.findByLabelText("読み取り結果の入力元"),
    ).toHaveTextContent("入力元：公開URL：careers.example.co.jp");
    expect(extractJobPostingMock).toHaveBeenCalledWith({
      type: "url",
      url: "https://careers.example.co.jp/jobs/medical-sales",
    });
  });

  it("rejects a disguised PDF before calling the AI API", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockClear();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "PDFを選択" }));
    const dropArea = screen.getByRole("group", {
      name: "求人票PDFのドロップ領域",
    });
    const disguisedText = new File(["plain text"], "求人票.pdf", {
      type: "application/pdf",
    });
    fireEvent.drop(dropArea, { dataTransfer: { files: [disguisedText] } });

    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(
      await screen.findByText(
        "PDFの内容を確認できません。正しいPDFファイルを選択してください。",
      ),
    ).toBeVisible();
    expect(extractJobPostingMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "AIで読み取る" })).toBeEnabled();

    const incompletePdf = new File(["%PDF-1.4\nbody"], "未完了求人票.pdf", {
      type: "application/pdf",
    });
    fireEvent.drop(dropArea, { dataTransfer: { files: [incompletePdf] } });
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(
      await screen.findByText(
        "PDFが壊れているか、読み込みが完了していません。別のPDFを選択してください。",
      ),
    ).toBeVisible();
    expect(extractJobPostingMock).not.toHaveBeenCalled();

    const encryptedPdf = new File(
      ["%PDF-1.4\ntrailer << /Encrypt 2 0 R >>\n%%EOF"],
      "保護された求人票.pdf",
      { type: "application/pdf" },
    );
    fireEvent.drop(dropArea, { dataTransfer: { files: [encryptedPdf] } });
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(
      await screen.findByText(
        "パスワード保護されたPDFは読み込めません。保護を解除したPDFを選択してください。",
      ),
    ).toBeVisible();
    expect(extractJobPostingMock).not.toHaveBeenCalled();
  });

  it("disables AI extraction when the current user has exhausted the limit", () => {
    usageQueryMock.mockReturnValue({
      data: {
        generatedAt: "2026-08-07T00:00:00.000Z",
        limits: { hourly: 20, daily: 50 },
        totals: {
          lastHour: 20,
          last24Hours: 20,
          completed: 20,
          failed: 0,
          running: 0,
        },
        byFeature: {
          candidate_summary: {
            lastHour: 10,
            last24Hours: 10,
            completed: 10,
            failed: 0,
            running: 0,
          },
          job_import: {
            lastHour: 10,
            last24Hours: 10,
            completed: 10,
            failed: 0,
            running: 0,
          },
        },
        byUser: [
          {
            userId: "11111111-1111-4111-8111-111111111111",
            lastHour: 20,
            last24Hours: 20,
            completed: 20,
            failed: 0,
            running: 0,
          },
        ],
      },
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "AIで読み取る" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("上限到達");
  });

  it("shows form differences before applying extracted values", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockResolvedValue({ data: extracted, error: null });
    const onApply = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[]}
          getCurrentValues={() => ({
            ...toJobFormValues(),
            title: "手入力の求人名",
            preferred_conditions: "既に入力した歓迎条件",
            salary_max: "500",
          })}
          onApply={onApply}
        />
      </QueryClientProvider>,
    );

    await user.type(
      screen.getByLabelText("求人票テキスト"),
      "医療機器営業の求人票です。東京都勤務、年収600万円以上です。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(await screen.findByText(/入力欄への変更内容（/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "企業照合：企業名・Webサイトが登録済み企業に一致しません。企業欄は変更せず、既存企業を手動で選択してください。",
      ),
    ).toBeVisible();
    expect(screen.getByText("登録前に入力が必要：企業")).toBeVisible();
    expect(screen.getByText("手入力の求人名")).toBeInTheDocument();
    expect(screen.getByText("循環器製品 営業担当")).toBeInTheDocument();
    expect(screen.getByText("「募集職種：循環器製品 営業担当」")).toBeVisible();
    expect(
      screen.getByText(
        "空欄への追加だけを初期選択しています。既存値の変更・クリアは、内容を確認して選択してください。",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("既に入力した歓迎条件")).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "求人名を反映" }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "職種を反映" })).toBeChecked();
    expect(
      screen.getByText(
        "入力内容の確認：年収上限は年収下限以上にしてください。",
      ),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "すべて選択" }));
    expect(
      screen.getByRole("checkbox", { name: "求人名を反映" }),
    ).toBeChecked();
    expect(
      screen.queryByText(
        "入力内容の確認：年収上限は年収下限以上にしてください。",
      ),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "推奨だけ選択" }));
    expect(
      screen.getByRole("checkbox", { name: "求人名を反映" }),
    ).not.toBeChecked();
    await user.click(screen.getByRole("button", { name: "すべて解除" }));
    expect(
      screen.getByRole("button", { name: "選択した内容を反映（0項目）" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "すべて選択" }));
    await user.click(screen.getByRole("checkbox", { name: "仕事内容を反映" }));
    await user.click(
      screen.getByRole("button", { name: /選択した内容を反映/ }),
    );
    expect(onApply).toHaveBeenCalledWith(
      extracted,
      expect.not.arrayContaining(["description"]),
    );
    expect(onApply.mock.calls[0]?.[1]).toContain("title");
    expect(
      screen.getByText(
        /AI抽出結果から\d+項目を反映しました。\d+項目は反映せず保留しています。求人の登録はまだ完了していません。/,
      ),
    ).toBeVisible();
    expect(screen.queryByText("読み取り結果")).not.toBeInTheDocument();
  });

  it("requires confirmation before applying selected fields without source evidence", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockResolvedValue({
      data: {
        ...extracted,
        evidence: [{ field: "title", quote: "募集職種：循環器製品 営業担当" }],
      },
      error: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.type(
      screen.getByLabelText("求人票テキスト"),
      "架空求人票の確認用テキストです。十分な長さの求人情報を記載します。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(
      await screen.findAllByText(
        "根拠未確認：求人票の原文を直接確認してください",
      ),
    ).not.toHaveLength(0);
    const applyButton = screen.getByRole("button", {
      name: /選択した内容を反映/,
    });
    expect(applyButton).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", {
        name: /根拠が表示されていない項目.*を求人票で確認しました/,
      }),
    );
    expect(applyButton).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "根拠ありだけ選択" }));
    expect(
      screen.getByRole("checkbox", { name: "求人名を反映" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "職種を反映" }),
    ).not.toBeChecked();
    expect(
      screen.queryByRole("checkbox", {
        name: /根拠が表示されていない項目.*を求人票で確認しました/,
      }),
    ).not.toBeInTheDocument();
    expect(applyButton).toBeEnabled();
  });

  it("selects the contact reset together with a company change", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockResolvedValue({ data: extracted, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => ({
            ...toJobFormValues(),
            company_id: "company-old",
            contact_id: "contact-old",
          })}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.type(
      screen.getByLabelText("求人票テキスト"),
      "医療機器営業の求人票です。東京都勤務、年収600万円以上です。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    const companyCheckbox = await screen.findByRole("checkbox", {
      name: "企業を反映",
    });
    expect(
      screen.getByText(
        "企業照合：登録済みの「メディカルデバイス株式会社」を企業欄へ反映できます（企業名・Webサイト一致）。",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "企業情報候補：業種 医療機器メーカー / Web https://medical-device.example.jp",
      ),
    ).toBeVisible();
    expect(
      screen.getByText(
        "必須項目：企業と求人名を確認できます。反映後に内容を確認して登録してください。",
      ),
    ).toBeVisible();
    const contactCheckbox = screen.getByRole("checkbox", {
      name: "採用担当者を反映",
    });
    expect(companyCheckbox).not.toBeChecked();
    expect(contactCheckbox).not.toBeChecked();
    expect(
      screen.getByText(
        "企業を変更する場合、以前の企業の採用担当者も同時にクリアします。",
      ),
    ).toBeVisible();

    await user.click(companyCheckbox);
    expect(companyCheckbox).toBeChecked();
    expect(contactCheckbox).toBeChecked();
    await user.click(contactCheckbox);
    expect(companyCheckbox).not.toBeChecked();
    expect(contactCheckbox).not.toBeChecked();
  });

  it("requires acknowledgement before applying a result with AI warnings", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockResolvedValue({
      data: {
        ...extracted,
        warnings: ["年収の表記に幅があり、上限額は要確認です。"],
      },
      error: null,
    });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    await user.type(
      screen.getByLabelText("求人票テキスト"),
      "医療機器営業の求人票です。年収は経験によって変動する可能性があります。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(
      await screen.findByText(
        "注意：年収の表記に幅があり、上限額は要確認です。",
      ),
    ).toBeVisible();
    const applyButton = screen.getByRole("button", {
      name: /選択した内容を反映/,
    });
    expect(applyButton).toBeDisabled();
    await user.click(
      screen.getByRole("checkbox", { name: "AIの注意事項を確認しました" }),
    );
    expect(applyButton).toBeEnabled();
  });

  it("locks the import source while extraction is in progress", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    let resolveExtraction:
      ((value: { data: JobImportResult; error: null }) => void) | undefined;
    extractJobPostingMock.mockReturnValue(
      new Promise((resolve) => {
        resolveExtraction = resolve;
      }),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const sourceInput = screen.getByLabelText("求人票テキスト");
    await user.type(
      sourceInput,
      "医療機器営業の求人票です。東京都勤務、年収600万円以上です。",
    );
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));

    expect(sourceInput).toBeDisabled();
    expect(screen.getByRole("button", { name: "PDFを選択" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "公開URLを入力" }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "完了するまで入力元を変更できません",
    );

    resolveExtraction?.({ data: extracted, error: null });
    expect(await screen.findByText("読み取り結果")).toBeVisible();
    expect(sourceInput).toBeEnabled();
  });

  it("reuses one of the recent import results after switching sources", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockClear();
    extractJobPostingMock.mockResolvedValue({ data: extracted, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const sourceInput = screen.getByLabelText("求人票テキスト");
    const firstSource =
      "循環器領域の医療機器営業です。東京都勤務、年収600万円以上です。";
    const secondSource =
      "整形外科領域の医療機器営業です。大阪府勤務、年収650万円以上です。";

    await user.type(sourceInput, firstSource);
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    expect(await screen.findByText("読み取り結果")).toBeVisible();

    await user.clear(sourceInput);
    await user.type(sourceInput, secondSource);
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    expect(await screen.findByText("読み取り結果")).toBeVisible();

    await user.clear(sourceInput);
    await user.type(sourceInput, firstSource);
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    expect(
      await screen.findByText(
        "前回の読み取り結果を再利用しました。追加のAI実行は発生していません。",
      ),
    ).toBeVisible();
    expect(extractJobPostingMock).toHaveBeenCalledTimes(2);
  });

  it("clears source data and the in-memory result cache on request", async () => {
    const user = userEvent.setup();
    usageQueryMock.mockReturnValue({ data: undefined });
    extractJobPostingMock.mockClear();
    extractJobPostingMock.mockResolvedValue({ data: extracted, error: null });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <JobImportPanel
          companies={[matchedCompany]}
          getCurrentValues={() => toJobFormValues()}
          onApply={vi.fn()}
        />
      </QueryClientProvider>,
    );

    const sourceInput = screen.getByLabelText("求人票テキスト");
    const source =
      "循環器領域の医療機器営業です。東京都勤務、年収600万円以上です。";
    await user.type(sourceInput, source);
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    expect(await screen.findByText("読み取り結果")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "入力とキャッシュを消去" }),
    );
    expect(sourceInput).toHaveValue("");
    expect(screen.queryByText("読み取り結果")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AIで読み取る" })).toBeDisabled();

    await user.type(sourceInput, source);
    await user.click(screen.getByRole("button", { name: "AIで読み取る" }));
    expect(await screen.findByText("読み取り結果")).toBeVisible();
    expect(extractJobPostingMock).toHaveBeenCalledTimes(2);
  });
});
