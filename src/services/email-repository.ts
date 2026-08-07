import {
  executePaginatedSelect,
  executeSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type {
  EmailMessageRow,
  EmailThreadRow,
  EmailThreadStatus,
} from "@/types/database";

export function listEmailThreads(): Promise<
  RepositoryResult<EmailThreadRow[]>
> {
  return executePaginatedSelect<EmailThreadRow>((client, from, to) =>
    client
      .from("email_threads")
      .select("*")
      .is("archived_at", null)
      .order("last_message_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
}

export function listEmailMessages(
  threadId: string,
): Promise<RepositoryResult<EmailMessageRow[]>> {
  return executeSelect<EmailMessageRow>((client) =>
    client
      .from("email_messages")
      .select("*")
      .eq("thread_id", threadId)
      .order("sent_at", { ascending: true }),
  );
}

export function updateEmailThreadStatus(
  threadId: string,
  status: EmailThreadStatus,
): Promise<RepositoryResult<EmailThreadRow>> {
  return executeSingle<EmailThreadRow>((client) =>
    client
      .from("email_threads")
      .update({ status })
      .eq("id", threadId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}
