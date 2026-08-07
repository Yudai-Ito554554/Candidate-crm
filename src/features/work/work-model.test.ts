import {
  activityFormSchema,
  taskFormSchema,
  toActivityValues,
  toTaskValues,
} from "@/features/work/work-model";

describe("work forms", () => {
  it("活動とタスクのタイトルを必須とする", () => {
    expect(
      activityFormSchema.safeParse({
        activity_type: "note",
        occurred_at: "2026-08-06T10:00",
        title: "",
        body: "",
        direction: "internal",
        job_id: "",
        application_id: "",
      }).success,
    ).toBe(false);
    expect(
      taskFormSchema.safeParse({
        candidate_id: "",
        job_id: "",
        application_id: "",
        task_type: "follow_up",
        title: "",
        description: "",
        priority: "medium",
        due_at: "",
        waiting_on: "none",
      }).success,
    ).toBe(false);
  });

  it("手動活動をAI生成ではない状態で保存する", () => {
    expect(
      toActivityValues("candidate-1", "user-1", {
        activity_type: "meeting",
        occurred_at: "2026-08-06T10:00",
        title: " 面談 ",
        body: "",
        direction: "internal",
        job_id: "",
        application_id: "",
      }),
    ).toEqual(
      expect.objectContaining({
        candidate_id: "candidate-1",
        owner_id: "user-1",
        title: "面談",
        body: null,
        ai_generated: false,
        metadata: {},
      }),
    );
  });

  it("タスクの期限と空文字をDB向けに変換する", () => {
    const result = toTaskValues("user-1", {
      candidate_id: "candidate-1",
      job_id: "",
      application_id: "",
      task_type: "email",
      title: " 連絡 ",
      description: "",
      priority: "high",
      due_at: "2026-08-06T11:00",
      waiting_on: "self",
    });

    expect(result).toEqual(
      expect.objectContaining({
        owner_id: "user-1",
        candidate_id: "candidate-1",
        job_id: null,
        title: "連絡",
      }),
    );
    expect(result.due_at).toContain("2026-08-06");
  });
});
