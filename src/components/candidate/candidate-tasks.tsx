import { Archive, Check, Pencil, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { EditorOnly } from "@/features/access/editor-only";
import { useJobsQuery } from "@/features/applications/application-queries";
import { TaskForm } from "@/features/work/task-form";
import {
  taskPriorityLabels,
  taskTypeLabels,
  waitingOnLabels,
} from "@/features/work/work-model";
import {
  useArchiveTaskMutation,
  useCompleteTaskMutation,
  useTasksDataQuery,
} from "@/features/work/work-queries";
import { formatDate, getLocalDateString } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TaskRow } from "@/types/database";

type TaskView = "未完了" | "完了" | "期限超過";
export function CandidateTasks({
  candidateId,
  initiallyAdding = false,
}: {
  candidateId: string;
  initiallyAdding?: boolean;
}) {
  const [view, setView] = useState<TaskView>("未完了");
  const [editing, setEditing] = useState<TaskRow | "new" | null>(
    initiallyAdding ? "new" : null,
  );
  const query = useTasksDataQuery();
  const jobsQuery = useJobsQuery();
  const completeMutation = useCompleteTaskMutation();
  const archiveMutation = useArchiveTaskMutation();
  const jobs = new Map((jobsQuery.data ?? []).map((job) => [job.id, job]));
  const today = getLocalDateString();
  const tasks = (query.data ?? [])
    .filter((task) => task.candidate_id === candidateId)
    .filter((task) =>
      view === "完了"
        ? Boolean(task.completed_at)
        : view === "期限超過"
          ? !task.completed_at &&
            Boolean(task.due_at) &&
            task.due_at!.slice(0, 10) < today
          : !task.completed_at,
    );
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-1.5">
        {" "}
        <div className="flex gap-1">
          {(["未完了", "完了", "期限超過"] as TaskView[]).map((item) => (
            <button
              aria-pressed={view === item}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium",
                view === item
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100",
              )}
              key={item}
              onClick={() => setView(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
        <EditorOnly>
          <Button
            aria-label="タスクタブでタスクを追加"
            className="gap-1.5"
            onClick={() => setEditing("new")}
            size="sm"
          >
            <Plus className="size-4" />
            タスク追加
          </Button>
        </EditorOnly>
      </div>
      {editing ? (
        <div className="mb-3">
          <TaskForm
            candidateId={candidateId}
            onClose={() => setEditing(null)}
            task={editing === "new" ? undefined : editing}
          />
        </div>
      ) : null}
      {query.isPending ? (
        <p className="py-8 text-center text-sm text-slate-500">
          タスクを読み込んでいます…
        </p>
      ) : query.isError ? (
        <EmptyState message={query.error.message} />
      ) : tasks.length ? (
        <TableContainer>
          <Table>
            <thead>
              <tr>
                <Th>期限</Th>
                <Th>優先度</Th>
                <Th>タスク</Th>
                <Th>種別</Th>
                <Th>関連求人</Th>
                <Th>待ち状態</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const overdue =
                  !task.completed_at &&
                  Boolean(task.due_at) &&
                  task.due_at!.slice(0, 10) < today;
                const job = task.job_id ? jobs.get(task.job_id) : undefined;
                return (
                  <tr key={task.id}>
                    <Td
                      className={overdue ? "font-semibold text-rose-700" : ""}
                    >
                      {formatDate((task.due_at ?? "-").slice(0, 10))}
                      {overdue ? " 期限超過" : ""}
                    </Td>
                    <Td>
                      <Badge value={taskPriorityLabels[task.priority]} />
                    </Td>
                    <Td className="font-medium">{task.title}</Td>
                    <Td>{taskTypeLabels[task.task_type]}</Td>
                    <Td>
                      {job ? (
                        <Link
                          className="text-blue-700 hover:underline"
                          to={`/jobs/${job.id}`}
                        >
                          {job.title}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>
                      <Badge value={waitingOnLabels[task.waiting_on]} />
                    </Td>
                    <Td>
                      <EditorOnly>
                        <div className="flex gap-1">
                          <Button
                            aria-label={`${task.title}を${task.completed_at ? "未完了に戻す" : "完了"}`}
                            disabled={completeMutation.isPending}
                            onClick={() =>
                              task.completed_at
                                ? completeMutation.reopen(task.id)
                                : completeMutation.complete(task.id)
                            }
                            size="sm"
                            variant="outline"
                          >
                            {task.completed_at ? (
                              <RotateCcw className="size-3.5" />
                            ) : (
                              <Check className="size-3.5" />
                            )}
                          </Button>
                          <Button
                            aria-label={`${task.title}を編集`}
                            onClick={() => setEditing(task)}
                            size="sm"
                            variant="outline"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            aria-label={`${task.title}をアーカイブ`}
                            className="text-rose-700"
                            disabled={archiveMutation.isPending}
                            onClick={() => archiveMutation.mutate(task.id)}
                            size="sm"
                            variant="outline"
                          >
                            <Archive className="size-3.5" />
                          </Button>
                        </div>
                      </EditorOnly>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </TableContainer>
      ) : (
        <EmptyState message={`${view}のタスクはありません`} />
      )}
    </div>
  );
}
