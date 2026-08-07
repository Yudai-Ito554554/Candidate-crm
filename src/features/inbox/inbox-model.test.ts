import {
  filterInboxThreads,
  inboxCategoryCount,
} from "@/features/inbox/inbox-model";
import type { EmailThreadRow } from "@/types/database";

const baseThread: EmailThreadRow = {
  id: "thread-1",
  owner_id: "user-1",
  candidate_id: "candidate-1",
  company_id: null,
  job_id: null,
  application_id: null,
  provider: "gmail",
  external_thread_id: "external-1",
  subject: "面接日程",
  participant_type: "candidate",
  status: "unhandled",
  has_ai_draft: false,
  last_sender_name: "候補者",
  last_message_preview: "日程を確認しました",
  last_message_at: "2026-08-06T09:00:00Z",
  archived_at: null,
  created_at: "2026-08-06T09:00:00Z",
  updated_at: "2026-08-06T09:00:00Z",
};

describe("inbox model", () => {
  const threads = [
    baseThread,
    {
      ...baseThread,
      id: "thread-2",
      participant_type: "company" as const,
      status: "waiting_reply" as const,
    },
    { ...baseThread, id: "thread-3", status: "handled" as const },
  ];

  it("filters workflow status categories", () => {
    expect(filterInboxThreads(threads, "未対応")).toHaveLength(1);
    expect(filterInboxThreads(threads, "返信待ち")).toHaveLength(1);
    expect(filterInboxThreads(threads, "対応済み")).toHaveLength(1);
  });

  it("counts participant categories independently of workflow status", () => {
    expect(inboxCategoryCount(threads, "候補者から")).toBe(2);
    expect(inboxCategoryCount(threads, "企業から")).toBe(1);
  });
});
