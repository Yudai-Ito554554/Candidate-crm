import {
  companyFormSchema,
  contactFormSchema,
  findCompanyDuplicates,
  quickCompanyFormSchema,
  toCompanyValues,
  toContactValues,
} from "@/features/applications/company-form-model";
import type { CompanyRow } from "@/types/database";

describe("company forms", () => {
  it("企業名と担当者名を必須とする", () => {
    expect(
      companyFormSchema.safeParse({
        name: "",
        name_kana: "",
        industry: "",
        employees: "",
        capital: "",
        listed: "",
        website: "",
        address: "",
        notes: "",
      }).success,
    ).toBe(false);
    expect(
      contactFormSchema.safeParse({
        full_name: "",
        department: "",
        position: "",
        email: "",
        phone: "",
        notes: "",
      }).success,
    ).toBe(false);
  });

  it("クイック登録でも企業名とWebサイト形式を検証する", () => {
    expect(
      quickCompanyFormSchema.safeParse({
        name: "医療株式会社",
        industry: "製薬",
        website: "ftp://example.com",
      }).success,
    ).toBe(false);
    expect(
      quickCompanyFormSchema.safeParse({
        name: "医療株式会社",
        industry: "製薬",
        website: "https://example.com",
      }).success,
    ).toBe(true);
  });

  it("企業と担当者の空文字をnullへ正規化する", () => {
    expect(
      toCompanyValues({
        name: " 医療株式会社 ",
        name_kana: "",
        industry: " 医療機器 ",
        employees: "500",
        capital: "",
        listed: "false",
        website: "",
        address: "",
        notes: "",
      }),
    ).toEqual(
      expect.objectContaining({
        name: "医療株式会社",
        industry: "医療機器",
        employees: 500,
        capital: null,
        listed: false,
      }),
    );
    expect(
      toContactValues("company-1", {
        full_name: " 採用 太郎 ",
        department: "",
        position: "",
        email: "",
        phone: "",
        notes: "",
      }),
    ).toEqual(
      expect.objectContaining({
        company_id: "company-1",
        full_name: "採用 太郎",
        email: null,
      }),
    );
  });

  it("企業名とWebサイトの表記を正規化して重複候補を見つける", () => {
    const companies = [
      {
        id: "company-001",
        name: "メディカル デバイス株式会社",
        website: "https://www.example.com/medical/",
      } as CompanyRow,
    ];

    expect(
      findCompanyDuplicates(
        {
          name: "メディカル　デバイス株式会社",
          website: "https://example.com/medical",
        },
        companies,
      ),
    ).toEqual([
      {
        company: companies[0],
        matchedFields: ["企業名", "Webサイト"],
      },
    ]);
  });
});
