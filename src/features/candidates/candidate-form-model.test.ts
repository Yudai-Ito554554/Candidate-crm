import {
  candidateFormSchema,
  findCandidateDuplicates,
  toCandidateValues,
  type CandidateFormValues,
} from "@/features/candidates/candidate-form-model";
import type { CandidateRow } from "@/types/database";

const validValues: CandidateFormValues = {
  full_name: "佐藤 健太",
  full_name_kana: "サトウ ケンタ",
  email: "kenta@example.com",
  phone: "090-0000-0001",
  birth_date: "1988-04-10",
  prefecture: "東京都",
  current_company: "医療機器株式会社",
  current_department: "営業部",
  current_job_title: "主任",
  current_occupation: "医療機器営業",
  candidate_status: "active_selection",
  desired_occupations: "医療機器営業、マネージャー",
  desired_locations: "東京都, 神奈川県",
  current_salary_min: "650",
  current_salary_max: "700",
  desired_salary_min: "750",
  desired_salary_max: "850",
  available_from: "2026-10-01",
  reason_for_change: "専門性を高めたい",
  priority_conditions: "製品力、年収",
  strengths: "関係構築",
  concerns: "英語",
  interview_summary: "経験が豊富",
  next_action: "面接日程確認",
  next_action_due_at: "2026-08-06T09:30",
  waiting_on: "company",
  source: "紹介",
  private_notes: "社内限定",
};

describe("candidate form model", () => {
  it("requires a name and valid salary ranges", () => {
    expect(
      candidateFormSchema.safeParse({ ...validValues, full_name: "" }).success,
    ).toBe(false);
    expect(
      candidateFormSchema.safeParse({
        ...validValues,
        desired_salary_min: "900",
        desired_salary_max: "800",
      }).success,
    ).toBe(false);
  });

  it("converts form input to database-safe values", () => {
    const result = toCandidateValues(validValues);

    expect(result).toMatchObject({
      full_name: "佐藤 健太",
      desired_occupations: ["医療機器営業", "マネージャー"],
      desired_locations: ["東京都", "神奈川県"],
      current_salary_min: 650,
      desired_salary_max: 850,
      waiting_on: "company",
      private_notes: "社内限定",
    });
    expect(result.next_action_due_at).toBe(
      new Date(validValues.next_action_due_at).toISOString(),
    );
  });

  it("normalizes optional empty values to null", () => {
    const result = toCandidateValues({
      ...validValues,
      email: "",
      current_salary_min: "",
      desired_occupations: "",
      next_action_due_at: "",
    });

    expect(result.email).toBeNull();
    expect(result.current_salary_min).toBeNull();
    expect(result.desired_occupations).toEqual([]);
    expect(result.next_action_due_at).toBeNull();
  });

  it("氏名・メール・電話番号を正規化して重複候補を見つける", () => {
    const candidates = [
      {
        id: "candidate-001",
        full_name: "佐藤 健太",
        email: "KENTA@EXAMPLE.COM",
        phone: "090-0000-0001",
      } as CandidateRow,
    ];

    const matches = findCandidateDuplicates(
      {
        full_name: "佐藤健太",
        email: "kenta@example.com",
        phone: "09000000001",
      },
      candidates,
    );

    expect(matches).toEqual([
      {
        candidate: candidates[0],
        matchedFields: ["氏名", "メールアドレス", "電話番号"],
      },
    ]);
  });
});
