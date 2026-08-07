import {
  findJobDuplicates,
  jobFormSchema,
  toJobValues,
} from "@/features/applications/job-form-model";
import type { JobRow } from "@/types/database";

const values = {
  company_id: "company-1",
  contact_id: "",
  title: " 営業担当 ",
  division: "",
  occupation: "",
  employment_type: "",
  locations: "東京都、大阪府",
  salary_min: "600",
  salary_max: "800",
  job_status: "open" as const,
  required_conditions: "",
  preferred_conditions: "",
  description: "",
  internal_notes: "",
  opened_at: "2026-08-01",
  closed_at: "2026-12-01",
};

describe("jobFormSchema", () => {
  it("企業と求人名を必須とし、年収レンジを検証する", () => {
    expect(jobFormSchema.safeParse({ ...values, company_id: "" }).success).toBe(
      false,
    );
    expect(
      jobFormSchema.safeParse({
        ...values,
        salary_min: "900",
        salary_max: "800",
      }).success,
    ).toBe(false);
  });

  it("勤務地と数値をDB向けに変換する", () => {
    expect(toJobValues(values)).toEqual(
      expect.objectContaining({
        company_id: "company-1",
        title: "営業担当",
        contact_id: null,
        locations: ["東京都", "大阪府"],
        salary_min: 600,
        salary_max: 800,
      }),
    );
  });

  it("同じ企業の求人名と勤務地の表記を正規化して重複候補を見つける", () => {
    const jobs = [
      {
        id: "job-001",
        company_id: "company-1",
        title: "TAVI製品 営業担当",
        division: "循環器事業部",
        occupation: "医療機器営業",
        locations: ["東京都", "大阪府"],
      } as JobRow,
    ];

    expect(
      findJobDuplicates(
        {
          company_id: "company-1",
          title: "ＴＡＶＩ製品営業担当",
          division: "循環器 事業部",
          occupation: "医療機器 営業",
          locations: "大阪府、東京都",
        },
        jobs,
      ),
    ).toEqual([
      {
        job: jobs[0],
        matchedFields: ["求人名", "事業部", "職種", "勤務地"],
      },
    ]);
  });
});
