import {
  experienceFormSchema,
  toExperienceValues,
} from "@/features/candidates/experience-form-model";

const validValues = {
  company_name: " 医療機器株式会社 ",
  department: "営業部",
  job_title: "主任",
  occupation: "医療機器営業",
  started_on: "2022-04-01",
  ended_on: "",
  is_current: true,
  experience_domain: "循環器",
  responsibilities: "提案営業",
  achievements: "目標達成",
};

describe("experienceFormSchema", () => {
  it("勤務先を必須とする", () => {
    const result = experienceFormSchema.safeParse({
      ...validValues,
      company_name: " ",
    });
    expect(result.success).toBe(false);
  });

  it("終了日が開始日より前の場合はエラーにする", () => {
    const result = experienceFormSchema.safeParse({
      ...validValues,
      is_current: false,
      ended_on: "2022-03-31",
    });
    expect(result.success).toBe(false);
  });

  it("在籍中の職歴では終了日を保存しない", () => {
    expect(toExperienceValues("candidate-1", validValues, 2)).toEqual(
      expect.objectContaining({
        candidate_id: "candidate-1",
        company_name: "医療機器株式会社",
        ended_on: null,
        sort_order: 2,
      }),
    );
  });
});
