import {
  executePaginatedSelect,
  executeSingle,
  type RepositoryResult,
} from "@/services/repository";
import type { TaskInsert, TaskRow, TaskUpdate } from "@/types/database";

export function listTasks(): Promise<RepositoryResult<TaskRow[]>> {
  return executePaginatedSelect<TaskRow>((client, from, to) =>
    client
      .from("tasks")
      .select("*")
      .is("archived_at", null)
      .order("due_at")
      .order("id")
      .range(from, to),
  );
}

export function createTask(
  values: TaskInsert,
): Promise<RepositoryResult<TaskRow>> {
  return executeSingle<TaskRow>((client) =>
    client.from("tasks").insert(values).select("*").single(),
  );
}

export function updateTask(
  taskId: string,
  values: TaskUpdate,
): Promise<RepositoryResult<TaskRow>> {
  return executeSingle<TaskRow>((client) =>
    client
      .from("tasks")
      .update(values)
      .eq("id", taskId)
      .is("archived_at", null)
      .select("*")
      .single(),
  );
}

export function archiveTask(
  taskId: string,
): Promise<RepositoryResult<TaskRow>> {
  return updateTask(taskId, { archived_at: new Date().toISOString() });
}
