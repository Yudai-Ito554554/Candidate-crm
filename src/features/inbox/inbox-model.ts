import type {
  EmailParticipantType,
  EmailThreadRow,
  EmailThreadStatus,
} from "@/types/database";

export type InboxCategory =
  "未対応" | "候補者から" | "企業から" | "返信待ち" | "対応済み";

export const inboxCategories: InboxCategory[] = [
  "未対応",
  "候補者から",
  "企業から",
  "返信待ち",
  "対応済み",
];

export const emailThreadStatusLabels: Record<EmailThreadStatus, string> = {
  unhandled: "未対応",
  waiting_reply: "返信待ち",
  handled: "対応済み",
};

export const emailParticipantLabels: Record<EmailParticipantType, string> = {
  candidate: "候補者から",
  company: "企業から",
  other: "その他",
};

export function filterInboxThreads(
  threads: EmailThreadRow[],
  category: InboxCategory,
) {
  return threads.filter((thread) => {
    if (category === "未対応") return thread.status === "unhandled";
    if (category === "返信待ち") return thread.status === "waiting_reply";
    if (category === "対応済み") return thread.status === "handled";
    if (category === "候補者から")
      return thread.participant_type === "candidate";
    return thread.participant_type === "company";
  });
}

export function inboxCategoryCount(
  threads: EmailThreadRow[],
  category: InboxCategory,
) {
  return filterInboxThreads(threads, category).length;
}
