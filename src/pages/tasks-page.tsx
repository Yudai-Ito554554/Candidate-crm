import { Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageIntro } from "@/components/common/page-intro";
import { PlannedButton } from "@/components/common/planned-button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableContainer, Td, Th } from "@/components/ui/table";
import { getCandidate, getJob, tasks } from "@/data/mock-data";
import { formatDate, isOverdue, mockToday } from "@/lib/format";
import { cn } from "@/lib/utils";

type TaskView = "本日" | "期限超過" | "今週" | "完了" | "全件";
const views: TaskView[] = ["本日", "期限超過", "今週", "完了", "全件"];

export function TasksPage() {
  const [view, setView] = useState<TaskView>("本日");
  const filteredTasks = tasks.filter((task) => {
    if (view === "本日")
      return task.dueDate === mockToday && task.status !== "完了";
    if (view === "期限超過")
      return isOverdue(task.dueDate, task.status === "完了");
    if (view === "今週")
      return (
        task.dueDate >= mockToday &&
        task.dueDate <= "2026-08-09" &&
        task.status !== "完了"
      );
    if (view === "完了") return task.status === "完了";
    return true;
  });

  return (
    <div>
      <PageIntro
        action={
          <PlannedButton className="gap-2" size="sm">
            <Plus className="size-4" />
            タスク追加
          </PlannedButton>
        }
        description="候補者対応と企業確認の期限を優先度順に確認します。"
        title="タスク一覧"
      />
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
            {item === "期限超過" ? (
              <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">
                1
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {filteredTasks.length ? (
        <TableContainer>
          <Table className="min-w-[980px]">
            <thead>
              <tr>
                <Th>期限</Th>
                <Th>優先度</Th>
                <Th>タスク内容</Th>
                <Th>対象候補者</Th>
                <Th>関連企業・求人</Th>
                <Th>種別</Th>
                <Th>ステータス</Th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => {
                const candidate = task.candidateId
                  ? getCandidate(task.candidateId)
                  : undefined;
                const job = task.jobId ? getJob(task.jobId) : undefined;
                const overdue = isOverdue(task.dueDate, task.status === "完了");
                return (
                  <tr className="hover:bg-blue-50/40" key={task.id}>
                    <Td
                      className={cn(
                        "whitespace-nowrap font-medium",
                        overdue && "text-rose-700",
                      )}
                    >
                      {formatDate(task.dueDate)}
                      {overdue ? (
                        <span className="ml-2 text-[10px] font-semibold">
                          期限超過
                        </span>
                      ) : null}
                    </Td>
                    <Td>
                      <Badge value={task.priority} />
                    </Td>
                    <Td className="min-w-56 font-medium text-slate-900">
                      {task.title}
                    </Td>
                    <Td className="whitespace-nowrap">
                      {candidate ? (
                        <Link
                          className="text-blue-700 hover:underline"
                          to={`/candidates/${candidate.id}`}
                        >
                          {candidate.name}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </Td>
                    <Td className="max-w-72">
                      <p className="font-medium text-slate-700">
                        {job?.company ?? "-"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {job?.title}
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">{task.type}</Td>
                    <Td>
                      <Badge value={task.status} />
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
