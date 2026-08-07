import {
  applicationFormSchema,
  toApplicationValues,
} from "@/features/applications/application-model";

const validValues = {
  job_id: "job-001",
  application_status: "proposed" as const,
  proposed_at: "2026-08-05T10:30",
  applied_at: "",
  next_event: " 応募意思確認 ",
  next_event_at: "2026-08-06T09:00",
  rejection_reason: "",
  withdrawal_reason: "",
  notes: " 社内メモ ",
};

describe("applicationFormSchema", () => {
  it("求人を必須とする", () => {
    expect(
      applicationFormSchema.safeParse({ ...validValues, job_id: "" }).success,
    ).toBe(false);
  });

  it("日時と空文字をDB向けに正規化する", () => {
    const result = toApplicationValues("candidate-001", validValues);
    expect(result).toEqual(
      expect.objectContaining({
        candidate_id: "candidate-001",
        job_id: "job-001",
        application_status: "proposed",
        applied_at: null,
        next_event: "応募意思確認",
        rejection_reason: null,
        notes: "社内メモ",
      }),
    );
    expect(result.proposed_at).toContain("2026-08-05");
  });
});
