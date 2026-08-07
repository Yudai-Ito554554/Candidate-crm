import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  archiveActivity,
  createActivity,
  listActivities,
  listCandidateActivities,
  updateActivity,
} from "@/services/activities-repository";
import {
  archiveTask,
  createTask,
  listTasks,
  updateTask,
} from "@/services/tasks-repository";
import type {
  ActivityInsert,
  ActivityRow,
  ActivityUpdate,
  TaskInsert,
  TaskRow,
  TaskUpdate,
} from "@/types/database";

export const workQueryKeys = {
  allActivities: ["activities"] as const,
  activities: (candidateId: string) =>
    ["candidates", candidateId, "activities"] as const,
  tasks: ["tasks"] as const,
};
async function unwrap<T>(
  promise: Promise<
    { data: T; error: null } | { data: null; error: { message: string } }
  >,
): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error("データを確認できませんでした。");
  return result.data;
}

export function useCandidateActivitiesQuery(candidateId: string) {
  return useQuery({
    queryKey: workQueryKeys.activities(candidateId),
    queryFn: () => unwrap<ActivityRow[]>(listCandidateActivities(candidateId)),
    enabled: Boolean(candidateId),
  });
}
export function useActivitiesQuery() {
  return useQuery({
    queryKey: workQueryKeys.allActivities,
    queryFn: () => unwrap<ActivityRow[]>(listActivities()),
  });
}
export function useTasksDataQuery() {
  return useQuery({
    queryKey: workQueryKeys.tasks,
    queryFn: () => unwrap<TaskRow[]>(listTasks()),
  });
}
export function useCreateActivityMutation(candidateId: string) {
  const client = useQueryClient();
  return useMutation<ActivityRow, Error, ActivityInsert>({
    mutationFn: (values) => unwrap<ActivityRow>(createActivity(values)),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: workQueryKeys.activities(candidateId),
      });
      void client.invalidateQueries({ queryKey: workQueryKeys.allActivities });
    },
  });
}
export function useUpdateActivityMutation(candidateId: string) {
  const client = useQueryClient();
  return useMutation<
    ActivityRow,
    Error,
    { id: string; values: ActivityUpdate }
  >({
    mutationFn: ({ id, values }) =>
      unwrap<ActivityRow>(updateActivity(id, values)),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: workQueryKeys.activities(candidateId),
      });
      void client.invalidateQueries({ queryKey: workQueryKeys.allActivities });
    },
  });
}
export function useArchiveActivityMutation(candidateId: string) {
  const client = useQueryClient();
  return useMutation<ActivityRow, Error, string>({
    mutationFn: (id) => unwrap<ActivityRow>(archiveActivity(id)),
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: workQueryKeys.activities(candidateId),
      });
      void client.invalidateQueries({ queryKey: workQueryKeys.allActivities });
    },
  });
}
export function useCreateTaskMutation() {
  const client = useQueryClient();
  return useMutation<TaskRow, Error, TaskInsert>({
    mutationFn: (values) => unwrap<TaskRow>(createTask(values)),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: workQueryKeys.tasks }),
  });
}
export function useUpdateTaskMutation() {
  const client = useQueryClient();
  return useMutation<TaskRow, Error, { id: string; values: TaskUpdate }>({
    mutationFn: ({ id, values }) => unwrap<TaskRow>(updateTask(id, values)),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: workQueryKeys.tasks }),
  });
}
export function useArchiveTaskMutation() {
  const client = useQueryClient();
  return useMutation<TaskRow, Error, string>({
    mutationFn: (id) => unwrap<TaskRow>(archiveTask(id)),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: workQueryKeys.tasks }),
  });
}
export function useCompleteTaskMutation() {
  const update = useUpdateTaskMutation();
  return {
    ...update,
    complete: (id: string) =>
      update.mutate({ id, values: { completed_at: new Date().toISOString() } }),
    reopen: (id: string) =>
      update.mutate({ id, values: { completed_at: null } }),
  };
}
