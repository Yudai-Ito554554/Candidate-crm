import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  listEmailMessages,
  listEmailThreads,
  updateEmailThreadStatus,
} from "@/services/email-repository";
import type {
  EmailMessageRow,
  EmailThreadRow,
  EmailThreadStatus,
} from "@/types/database";

export const inboxQueryKeys = {
  threads: ["email-threads"] as const,
  messages: (threadId: string) =>
    ["email-threads", threadId, "messages"] as const,
};

async function unwrap<T>(
  promise: Promise<
    { data: T; error: null } | { data: null; error: { message: string } }
  >,
): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  if (result.data === null)
    throw new Error("メールデータを確認できませんでした。");
  return result.data;
}

export function useEmailThreadsQuery() {
  return useQuery({
    queryKey: inboxQueryKeys.threads,
    queryFn: () => unwrap<EmailThreadRow[]>(listEmailThreads()),
  });
}

export function useEmailMessagesQuery(threadId: string) {
  return useQuery({
    queryKey: inboxQueryKeys.messages(threadId),
    queryFn: () => unwrap<EmailMessageRow[]>(listEmailMessages(threadId)),
    enabled: Boolean(threadId),
  });
}

export function useUpdateEmailThreadStatusMutation() {
  const client = useQueryClient();
  return useMutation<
    EmailThreadRow,
    Error,
    { threadId: string; status: EmailThreadStatus }
  >({
    mutationFn: ({ threadId, status }) =>
      unwrap<EmailThreadRow>(updateEmailThreadStatus(threadId, status)),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: inboxQueryKeys.threads }),
  });
}
