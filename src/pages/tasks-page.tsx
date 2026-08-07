import { Archive, Check, Pencil, Plus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { EditorOnly } from "@/features/access/editor-only";
import {
  useCompaniesQuery,
  useJobsQuery,
} from "@/features/applications/application-queries";
import { useCandidatesQuery } from "@/features/candidates/candidate-queries";
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

type TaskView = "本日" | "期限超過" | "今週" | "完了" | "全件";
const views: TaskView[] = ["本日", "期限超過", "今週", "完了", "全件"];

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return getLocalDateString(date);
}

export function TasksPage() {
  const [view, setView] = useState<TaskView>("本日");
  const [editing, setEditing] = useState<TaskRow | "new" | null>(null);
  const query = useTasksDataQuery();
  const candidatesQuery = useCandidatesQuery();
  const jobsQuery = useJobsQuery();
  const companiesQuery = useCompaniesQuery();
  const completeMutation = useCompleteTaskMutation();
  const archiveMutation = useArchiveTaskMutation();
  const today = getLocalDateString();
  const weekEnd = addDays(today, 6);
  const candidates = new Map(
    (candidatesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const jobs = new Map((jobsQuery.data ?? []).map((item) => [item.id, item]));
  const companies = new Map(
    (companiesQuery.data ?? []).map((item) => [item.id, item]),
  );
  const allTasks = query.data ?? [];
  const overdueCount = allTasks.filter(
    (task) =>
      !task.completed_at &&
      Boolean(task.due_at) &&
      task.due_at!.slice(0, 10) < today,
  ).length;
  const tasks = allTasks.filter((task) => {
    const due = task.due_at?.slice(0, 10);
    if (view === "本日") return due === today && !task.completed_at;
    if (view === "期限超過")
      return Boolean(due) && due! < today && !task.completed_at;
    if (view === "今週")
      return (
        Boolean(due) && due! >= today && due! <= weekEnd && !task.completed_at
      );
    if (view === "完了") return Boolean(task.completed_at);
    return true;
  });
  return (
    <div>
      <PageIntro
        action={
          <EditorOnly>
            <Button
              className="gap-2"
              onClick={() => setEditing("new")}
              size="sm"
            >
              <Plus className="size-4" />
              タスク追加
            </Button>
          </EditorOnly>
        }
        description="候補者対応と企業確認の期限を優先度順に確認します。"
        title="タスク一覧"
      />
      {editing ? (
        <div className="mb-3">
          <TaskForm
            onClose={() => setEditing(null)}
            task={editing === "new" ? undefined : editing}
          />
        </div>
      ) : null}
      <div className="mb-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm">
        {views.map((item) => (
          <button
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium",
              view === item
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100",
            )}
            key={item}
            onClick={() => setView(item)}
            type="button"
          >
            {item}
            {item === "期限超過" && overdueCount ? (
              <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
                {overdueCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <p className="py-12 text-center text-sm text-slate-500">
          タスクを読み込んでいます…
        </p>
      ) : query.isError ? (
        <EmptyState message={query.error.message} />
      ) : tasks.length ? (
        <TableContainer>
          <Table className="min-w-[1100px]">
            <thead>
              <tr>
                <Th>期限</Th>
                <Th>優先度</Th>
                <Th>タスク内容</Th>
                <Th>対象候補者</Th>
                <Th>関連企業・求人</Th>
                <Th>種別</Th>
                <Th>待ち状態</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const due = task.due_at?.slice(0, 10);
                const overdue =
                  !task.completed_at && Boolean(due) && due! < today;
                const candidate = task.candidate_id
                  ? candidates.get(task.candidate_id)
                  : undefined;
                const job = task.job_id ? jobs.get(task.job_id) : undefined;
                const company = job ? companies.get(job.company_id) : undefined;
                return (
                  <tr
                    className={task.completed_at ? "opacity-65" : ""}
                    key={task.id}
                  >
                    <Td
                      className={cn(
                        "whitespace-nowrap font-medium",
                        overdue && "text-rose-700",
                      )}
                    >
                      {formatDate(due ?? "-")}
                      {overdue ? " 期限超過" : ""}
                    </Td>
                    <Td>
                      <Badge value={taskPriorityLabels[task.priority]} />
                    </Td>
                    <Td className="min-w-56 font-medium">{task.title}</Td>
                    <Td>
                      {candidate ? (
                        <Link
                          className="text-blue-700 hover:underline"
                          to={`/candidates/${candidate.id}`}
                        >
                          {candidate.full_name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td>
                      <p>{company?.name ?? "-"}</p>
                      <p className="text-xs text-slate-500">{job?.title}</p>
                    </Td>
                    <Td>{taskTypeLabels[task.task_type]}</Td>
                    <Td>
                      <Badge value={waitingOnLabels[task.waiting_on]} />
                    </Td>
                    <Td>
                      <EditorOnly>
                        <div className="flex gap-1">
                          <Button
                            aria-label={`${task.title}を${task.completed_at ? "未完了に戻す" : "完了"}`}
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
